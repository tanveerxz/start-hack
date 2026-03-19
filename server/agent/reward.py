"""
server/agent/reward.py

Reward function for the Mars greenhouse RL agent.
Runs once per simulated sol, AFTER all simulation and planning is complete.

Responsibility:
  - Combine nutrition output, resource efficiency, plant health,
    and critical safety flags into a single scalar reward signal
  - Feed that signal to rl_agent.py for policy update

Why the reward design matters:
  The RL agent will optimise for exactly what this function rewards.
  The 4 components map directly to the Syngenta judging criteria:
    1. Nutrition score     → "optimise nutrient output, dietary balance"
    2. Efficiency score    → "resource efficiency" (water/nutrient recycling)
    3. Stress penalty      → "detect and respond to plant stress"
    4. Critical penalty    → "human safety first" (doc 06 priority hierarchy)

  Weights are tuned so the agent prioritises in the right order:
  keeping crew alive > keeping crops healthy > maximising yield > conserving stock

Reward range: [-1.0, 1.0]
  +1.0 = perfect sol (all nutrition met, full recycling, no stress, no crits)
   0.0 = marginal sol (partial nutrition, some inefficiency)
  -1.0 = catastrophic sol (crew starving, water gone, critical failures)

Inputs (all produced by completed files):
  SimulationResult  ← crops.py
  ResourceStatus    ← resources.py
  DailySchedule     ← planner.py
  CrewNutritionNeeds ← models.py

Called by: main.py (after planner.plan())
Feeds into: rl_agent.py (policy update input)
"""

from __future__ import annotations
import logging
from dataclasses import dataclass

from agent.models import CrewNutritionNeeds, DailySchedule
from environment.crops import SimulationResult
from environment.resources import ResourceStatus

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# REWARD WEIGHTS
# Must sum to 1.0 — reflect the Syngenta priority hierarchy
# ─────────────────────────────────────────────────────────────────────────────

W_NUTRITION  = 0.40   # Primary objective — crew must eat
W_EFFICIENCY = 0.30   # Core Syngenta criterion — resource recycling
W_STRESS     = 0.20   # Plant health — stress = lower future yield
W_CRITICAL   = 0.10   # Hard safety floor — critical = mission failure risk

assert abs(W_NUTRITION + W_EFFICIENCY + W_STRESS + W_CRITICAL - 1.0) < 0.001


# ─────────────────────────────────────────────────────────────────────────────
# REWARD BREAKDOWN — what the RL agent and frontend can inspect
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RewardSignal:
    """
    Full reward breakdown for one sol.
    The scalar `total` is what rl_agent.py uses for the policy update.
    The component scores are logged and sent to the frontend so the
    team can see exactly why the agent is making the decisions it makes.
    """
    day: int

    # Component scores — each in [0.0, 1.0] before weighting
    nutrition_score:  float    # how well crew calorie + protein needs were met
    efficiency_score: float    # water recycling + nutrient conservation
    stress_score:     float    # plant health (1.0 = no stress, 0.0 = severe)
    critical_score:   float    # 1.0 if no critical flags, 0.0 if any critical

    # Weighted contributions
    nutrition_contribution:  float
    efficiency_contribution: float
    stress_contribution:     float
    critical_contribution:   float

    # Final signal in [-1.0, 1.0]
    total: float

    # Diagnostic strings — explain the reward in plain English
    nutrition_note:  str = ""
    efficiency_note: str = ""
    stress_note:     str = ""
    critical_note:   str = ""


# ─────────────────────────────────────────────────────────────────────────────
# COMPONENT 1 — NUTRITION SCORE  (weight: 40%)
# Are the 4 astronauts getting what they need?
# ─────────────────────────────────────────────────────────────────────────────

# Rolling harvest history — main.py appends daily_harvested_kcal each sol
# reward.py uses this to score nutrition over a 30-sol window
# Imported and mutated by main.py
harvest_kcal_history:    list[float] = []
harvest_protein_history: list[float] = []


def _score_nutrition(
    sim: SimulationResult,
    needs: CrewNutritionNeeds,
) -> tuple[float, str]:
    """
    Scores nutrition based on actual harvested food, not standing crop value.

    The crew needs 12,000 kcal/day. The greenhouse produces food in bursts
    on harvest days. We score using a 30-sol rolling average of harvested
    kcal — this reflects whether the greenhouse is producing enough food
    over time to keep the crew fed, which is the agronomically correct metric.

    On a non-harvest sol: score reflects recent harvest history.
    On a harvest sol: that harvest is included in the window.

    This means:
      Sols 1-21:  low score — no harvests yet, crew on stored food
      Sol 22+:    score rises as harvests accumulate
      Sol 71+:    score approaches 1.0 as full rotation kicks in

    The greenhouse supplements stored food — it doesn't replace it entirely.
    Realistic target is ~40% of daily needs from the greenhouse.
    """
    # Add today's harvest to history
    harvest_kcal_history.append(sim.daily_harvested_kcal)
    harvest_protein_history.append(sim.daily_harvested_protein_g)

    # 30-sol rolling average — smooths out the burst nature of harvests
    window = 60
    recent_kcal    = harvest_kcal_history[-window:]
    recent_protein = harvest_protein_history[-window:]
    avg_kcal    = sum(recent_kcal)    / len(recent_kcal)
    avg_protein = sum(recent_protein) / len(recent_protein)

    # Score against daily target — greenhouse provides ~40% realistically
    # Cap at 1.0 so overproduction doesn't mask inefficiency
    calorie_coverage = min(avg_kcal    / needs.kcal_per_day,    1.0)
    protein_coverage = min(avg_protein / needs.protein_g_per_day, 1.0)

    # Calorie: 60% weight within nutrition, protein: 40%
    score = (calorie_coverage * 0.60) + (protein_coverage * 0.40)

    note = (
        f"Calories: {calorie_coverage:.0%} of daily target "
        f"(30-sol avg: {avg_kcal:.0f}/{needs.kcal_per_day:.0f} kcal) | "
        f"Protein: {protein_coverage:.0%} of daily target "
        f"(30-sol avg: {avg_protein:.0f}/{needs.protein_g_per_day:.0f}g)"
    )

    logger.info("Nutrition score: %.3f | %s", score, note)
    return round(score, 4), note


# ─────────────────────────────────────────────────────────────────────────────
# COMPONENT 2 — EFFICIENCY SCORE  (weight: 30%)
# How well is the closed-loop system conserving resources?
# ─────────────────────────────────────────────────────────────────────────────

def _score_efficiency(
    res: ResourceStatus,
) -> tuple[float, str]:
    """
    Scores resource efficiency across water and nutrients.

    Three sub-scores:

    1. Water recycling ratio:
       recycled / consumed — target is >85% (our recycling_efficiency target).
       Perfect score if recycling ≥ 85% of consumed water.
       This is the Syngenta "closed-loop water" criterion directly.

    2. Nutrient stock conservation:
       Average of N, K, Fe stock remaining fractions.
       Rewards the agent for not wasting nutrients — a stock depleted
       at day 200 of a 450-day mission is a failure even if plants
       looked healthy up to that point.

    3. Water reserve health:
       Ratio of current water to a "comfortable" level (300L).
       Penalises running reserves low even before hitting critical.
       Teaches the agent to maintain a buffer, not just avoid zero.
    """

    # Sub-score 1: recycling ratio
    if res.water_consumed_liters > 0:
        recycle_ratio = min(res.water_recycled_liters / res.water_consumed_liters, 1.0)
    else:
        recycle_ratio = 1.0   # no consumption = perfect efficiency

    recycle_score = recycle_ratio / 0.65   # normalise: 65% recycling = score 1.0
    # 65% is realistic for a 100m² hydroponic greenhouse with ~500L/day consumption.
    # 85% would require either far lower crop water use or a much larger condensate system.
    recycle_score = min(recycle_score, 1.0)

    # Sub-score 2: nutrient stock conservation
    stock_score = (
        res.n_stock_remaining_pct  * 0.40 +
        res.k_stock_remaining_pct  * 0.35 +
        res.fe_stock_remaining_pct * 0.25
    )

    # Sub-score 3: water reserve health
    COMFORTABLE_WATER = 300.0
    reserve_score = min(res.water_available_liters / COMFORTABLE_WATER, 1.0)

    # Combine — recycling most important (Syngenta criterion), then stock, then reserve
    score = (recycle_score * 0.50) + (stock_score * 0.30) + (reserve_score * 0.20)

    note = (
        f"Recycling: {recycle_ratio:.0%} ({res.water_recycled_liters:.1f}L recovered) | "
        f"Stock: N={res.n_stock_remaining_pct:.0%} K={res.k_stock_remaining_pct:.0%} "
        f"Fe={res.fe_stock_remaining_pct:.0%} | "
        f"Reserve: {res.water_available_liters:.0f}L"
    )

    logger.info("Efficiency score: %.3f | %s", score, note)
    return round(score, 4), note


# ─────────────────────────────────────────────────────────────────────────────
# COMPONENT 3 — STRESS SCORE  (weight: 20%)
# How healthy are the plants?
# ─────────────────────────────────────────────────────────────────────────────

def _score_stress(
    sim: SimulationResult,
    schedule: DailySchedule,
) -> tuple[float, str]:
    """
    Scores plant health based on stress reports from crops.py.

    Starts at 1.0 (perfect health) and deducts for each stress event.
    Deduction = severity × stress_weight (severe stress hurts more).

    Two additional factors:
      - Stress that the planner RESPONDED to (in schedule.stress_responses)
        gets a 50% discount — the system caught it and acted, which is good.
      - Multiple simultaneous stresses on the same crop compound — the
        plant can't recover from heat AND drought at the same time.

    Score floor is 0.0 — can't go negative from stress alone.
    """
    if not sim.all_stress_reports:
        logger.info("Stress score: 1.000 | No stress detected.")
        return 1.0, "No stress events this sol."

    # Which stresses did the planner already respond to?
    responded_stress_types = {r.stress_type for r in schedule.stress_responses}

    total_deduction = 0.0
    stress_notes    = []

    for report in sim.all_stress_reports:
        deduction = report.severity

        # Discount if planner already caught and responded to this stress type
        if report.stress_type in responded_stress_types:
            deduction *= 0.50

        total_deduction += deduction
        stress_notes.append(
            f"{report.crop_type.value}/{report.stress_type.value} "
            f"(sev={report.severity:.2f})"
        )

    score = max(1.0 - total_deduction, 0.0)
    note  = f"{len(sim.all_stress_reports)} stress events: {', '.join(stress_notes)}"

    logger.info("Stress score: %.3f | %s", score, note)
    return round(score, 4), note


# ─────────────────────────────────────────────────────────────────────────────
# COMPONENT 4 — CRITICAL PENALTY  (weight: 10%)
# Hard floor — critical events cannot be compensated by good performance elsewhere
# ─────────────────────────────────────────────────────────────────────────────

def _score_critical(
    res: ResourceStatus,
    sim: SimulationResult,
) -> tuple[float, str]:
    """
    Binary component — 1.0 if no critical events, 0.0 if any.

    This is intentionally cliff-edge rather than gradual.
    The RL agent needs to treat critical events as categorically
    different from merely bad performance — they are mission-threatening.

    Critical events (from docs 05 and 06, priority hierarchy):
      - Water reserves below 100L  (crew dehydration risk)
      - Any nutrient below critical (crop die-off within days)
      - CO2 above 1500 ppm         (human safety — highest priority)

    A single critical event caps the entire day's reward contribution
    from this component at 0.0, regardless of how well everything else went.
    """
    critical_flags = []

    if res.water_critical:
        critical_flags.append(f"water={res.water_available_liters:.0f}L")

    if res.nutrients_critical:
        critical_flags.append(
            f"N={res.nutrient_n_ppm:.1f} K={res.nutrient_k_ppm:.1f} Fe={res.nutrient_fe_ppm:.3f}"
        )

    # CO2 safety check — pull from stress reports (crops.py flagged it)
    from agent.models import StressType
    co2_critical = any(
        r.stress_type == StressType.CO2_HIGH and r.severity >= 0.7
        for r in sim.all_stress_reports
    )
    if co2_critical:
        critical_flags.append("CO2>1500ppm HUMAN SAFETY")

    if critical_flags:
        note = f"CRITICAL FLAGS: {' | '.join(critical_flags)}"
        logger.error("Critical score: 0.000 | %s", note)
        return 0.0, note

    logger.info("Critical score: 1.000 | All systems safe.")
    return 1.0, "No critical events."


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def score(
    sim: SimulationResult,
    res: ResourceStatus,
    schedule: DailySchedule,
    needs: CrewNutritionNeeds,
    crew_state=None,
) -> RewardSignal:
    """
    Compute the full reward signal for this sol.
    Called by main.py after planner.plan().
    Output fed directly to rl_agent.update_policy().

    The total reward is a weighted sum of 4 component scores,
    then rescaled from [0.0, 1.0] to [-1.0, 1.0] so the RL
    agent gets negative signal on bad sols — standard RL practice.

    Rescaling: total = (raw_score * 2.0) - 1.0
      raw=1.0 → total=+1.0  (perfect)
      raw=0.5 → total= 0.0  (marginal)
      raw=0.0 → total=-1.0  (catastrophic)
    """

    # ── Score each component ──────────────────────────────────────────────────
    nutrition_score,  nutrition_note  = _score_nutrition(sim, needs)
    efficiency_score, efficiency_note = _score_efficiency(res)
    stress_score,     stress_note     = _score_stress(sim, schedule)
    critical_score,   critical_note   = _score_critical(res, sim)

    # ── Weighted sum ──────────────────────────────────────────────────────────
    nutrition_contrib  = nutrition_score  * W_NUTRITION
    efficiency_contrib = efficiency_score * W_EFFICIENCY
    stress_contrib     = stress_score     * W_STRESS
    critical_contrib   = critical_score   * W_CRITICAL

    raw_score = (
        nutrition_contrib +
        efficiency_contrib +
        stress_contrib +
        critical_contrib
    )

    # ── Rescale to [-1.0, 1.0] ───────────────────────────────────────────────
    total = round((raw_score * 2.0) - 1.0, 4)

    signal = RewardSignal(
        day                      = sim.day,
        nutrition_score          = nutrition_score,
        efficiency_score         = efficiency_score,
        stress_score             = stress_score,
        critical_score           = critical_score,
        nutrition_contribution   = round(nutrition_contrib,  4),
        efficiency_contribution  = round(efficiency_contrib, 4),
        stress_contribution      = round(stress_contrib,     4),
        critical_contribution    = round(critical_contrib,   4),
        total                    = total,
        nutrition_note           = nutrition_note,
        efficiency_note          = efficiency_note,
        stress_note              = stress_note,
        critical_note            = critical_note,
    )

    logger.info(
        "Sol %d reward | nutrition=%.3f efficiency=%.3f stress=%.3f critical=%.3f → TOTAL=%.4f",
        sim.day,
        nutrition_score, efficiency_score, stress_score, critical_score,
        total,
    )

    return signal