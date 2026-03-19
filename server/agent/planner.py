"""
server/agent/planner.py

The daily planning brain of the Mars greenhouse.
Called once per simulated sol (Martian day).

Flow:
  1. assess()        → what does the crew need nutritionally right now?
  2. allocate()      → how should we split the 100m² of floor space?
  3. schedule()      → what gets planted / harvested today?
  4. stress_respond()→ override schedule if crops.py flagged problems
  5. plan()          → orchestrates all 4 phases, returns DailySchedule

Imports from:  agent/models.py
Called by:     main.py (once per sim day)
Feeds into:    reward.py, rl_agent.py, api/schemas.py
"""

from __future__ import annotations
import logging
from dataclasses import dataclass

from agent.models import (
    AreaAllocation,
    CrewNutritionNeeds,
    CropProfile,
    CropType,
    DailySchedule,
    GreenhouseState,
    GrowthSystem,
    PlantingEvent,
    PlantStressReport,
    StressType,
    default_crop_profiles,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS  (tuneable without touching logic)
# ─────────────────────────────────────────────────────────────────────────────

# How far below target before we call it a "deficit" (fraction of daily need)
CALORIE_DEFICIT_THRESHOLD  = 0.85   # below 85% of daily kcal target → act
PROTEIN_DEFICIT_THRESHOLD  = 0.85

# Area allocation hard limits (from doc 03 strategic model)
ALLOC_LIMITS = {
    CropType.POTATO:  (0.40, 0.50),
    CropType.LEGUME:  (0.20, 0.30),
    CropType.LETTUCE: (0.15, 0.20),
    CropType.RADISH:  (0.05, 0.10),
    CropType.HERB:    (0.03, 0.08),
}

# Default starting allocation (midpoints of the ranges above)
DEFAULT_ALLOC = AreaAllocation(
    potato_pct  = 0.45,
    legume_pct  = 0.25,
    lettuce_pct = 0.18,
    radish_pct  = 0.07,
    herb_pct    = 0.05,
)

# Severity above which a stress event forces a schedule override
STRESS_OVERRIDE_THRESHOLD = 0.4


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — ASSESS
# What does the crew actually need right now?
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class NutritionAssessment:
    """
    The result of comparing what the greenhouse is producing
    against what the crew needs.  All values are fractions of
    daily target (1.0 = fully met, <1.0 = deficit).
    """
    calorie_coverage:  float   # projected_kcal / daily_kcal_target
    protein_coverage:  float   # projected_protein / daily_protein_target
    calorie_deficit:   bool    # True if coverage < CALORIE_DEFICIT_THRESHOLD
    protein_deficit:   bool    # True if coverage < PROTEIN_DEFICIT_THRESHOLD
    days_to_next_harvest: dict[CropType, int]  # how many days until each crop is ready


def assess(
    state: GreenhouseState,
    needs: CrewNutritionNeeds,
    active_crops: dict[CropType, int],   # crop → day it was planted
    profiles: dict[CropType, CropProfile],
) -> NutritionAssessment:
    """
    Phase 1: read the current state and compute what the crew needs.

    active_crops is a dict maintained by main.py that tracks
    which crops are currently growing and when they were planted.
    We use it to estimate days-to-harvest for each crop type.
    """

    # ── Estimate today's caloric and protein output ──────────────────────────
    # We project yield from the area allocation and average growth cycle.
    # This is deliberately simple — the RL agent will refine it over time.

    projected_kcal    = 0.0
    projected_protein = 0.0

    for crop_type, plant_day in active_crops.items():
        profile    = profiles[crop_type]
        days_grown = state.day - plant_day
        cycle_mid  = (profile.growth_cycle_days_min + profile.growth_cycle_days_max) / 2

        # Linear growth model: crop contributes proportionally as it matures
        maturity = min(days_grown / cycle_mid, 1.0)

        # Area for this crop (from greenhouse total and default allocation)
        alloc_pct  = _alloc_pct_for(crop_type, DEFAULT_ALLOC)
        area_m2    = state.total_area_m2 * alloc_pct

        # Estimated edible yield today (kg) — average yield × harvest index × maturity
        avg_yield_kg_m2 = (profile.yield_kg_m2_min + profile.yield_kg_m2_max) / 2
        edible_kg       = avg_yield_kg_m2 * area_m2 * profile.harvest_index * maturity

        # Convert to nutrition
        projected_kcal    += (edible_kg * 1000 / 100) * profile.kcal_per_100g
        projected_protein += (edible_kg * 1000 / 100) * profile.protein_g_per_100g

    calorie_coverage = projected_kcal    / needs.kcal_per_day    if needs.kcal_per_day    > 0 else 0.0
    protein_coverage = projected_protein / needs.protein_g_per_day if needs.protein_g_per_day > 0 else 0.0

    # ── Days to next harvest per crop ────────────────────────────────────────
    days_to_harvest: dict[CropType, int] = {}
    for crop_type, plant_day in active_crops.items():
        profile    = profiles[crop_type]
        days_grown = state.day - plant_day
        remaining  = max(profile.growth_cycle_days_min - days_grown, 0)
        days_to_harvest[crop_type] = remaining

    assessment = NutritionAssessment(
        calorie_coverage      = calorie_coverage,
        protein_coverage      = protein_coverage,
        calorie_deficit       = calorie_coverage  < CALORIE_DEFICIT_THRESHOLD,
        protein_deficit       = protein_coverage  < PROTEIN_DEFICIT_THRESHOLD,
        days_to_next_harvest  = days_to_harvest,
    )

    logger.info(
        "Day %d | Calorie coverage: %.1f%% | Protein coverage: %.1f%%",
        state.day,
        calorie_coverage  * 100,
        protein_coverage  * 100,
    )
    return assessment


def _alloc_pct_for(crop_type: CropType, alloc: AreaAllocation) -> float:
    """Helper: pull the allocation percentage for a given crop."""
    return {
        CropType.POTATO:  alloc.potato_pct,
        CropType.LEGUME:  alloc.legume_pct,
        CropType.LETTUCE: alloc.lettuce_pct,
        CropType.RADISH:  alloc.radish_pct,
        CropType.HERB:    alloc.herb_pct,
    }[crop_type]


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — ALLOCATE
# How should we split the floor space given the nutrition assessment?
# ─────────────────────────────────────────────────────────────────────────────

def allocate(
    assessment: NutritionAssessment,
    current_alloc: AreaAllocation,
    rl_override: AreaAllocation | None = None,
) -> AreaAllocation:
    """
    Phase 2: adjust area allocation based on what the crew is short on.

    Logic priority (from doc 05 — priority hierarchy):
      1. Calorie deficit  → push potatoes toward their upper limit
      2. Protein deficit  → push legumes toward their upper limit
      3. Both fine        → hold current allocation steady

    If the RL agent has computed an override allocation, use that instead —
    this is how the RL loop gradually takes control from the rule-based logic.

    All adjustments are clamped to ALLOC_LIMITS so we never go outside
    the agronomically safe ranges from doc 03.
    """

    # ── RL override takes priority once the agent is trained enough ──────────
    if rl_override is not None:
        if rl_override.validate():
            logger.info("Day: using RL-computed allocation override.")
            return rl_override
        else:
            logger.warning("RL allocation invalid (doesn't sum to 1.0). Ignoring.")

    # ── Start from current allocation, apply rule-based nudges ───────────────
    potato_pct  = current_alloc.potato_pct
    legume_pct  = current_alloc.legume_pct
    lettuce_pct = current_alloc.lettuce_pct
    radish_pct  = current_alloc.radish_pct
    herb_pct    = current_alloc.herb_pct

    NUDGE = 0.03  # shift 3% of area per deficit event

    if assessment.calorie_deficit:
        # Take space from herbs (lowest priority) and give to potatoes
        potato_pct += NUDGE
        herb_pct   -= NUDGE
        logger.info("Calorie deficit detected — increasing potato allocation by %.0f%%.", NUDGE * 100)

    if assessment.protein_deficit:
        # Take space from radishes and give to legumes
        legume_pct += NUDGE
        radish_pct -= NUDGE
        logger.info("Protein deficit detected — increasing legume allocation by %.0f%%.", NUDGE * 100)

    # ── Clamp everything to its agronomic limits ─────────────────────────────
    potato_pct  = _clamp(potato_pct,  *ALLOC_LIMITS[CropType.POTATO])
    legume_pct  = _clamp(legume_pct,  *ALLOC_LIMITS[CropType.LEGUME])
    lettuce_pct = _clamp(lettuce_pct, *ALLOC_LIMITS[CropType.LETTUCE])
    radish_pct  = _clamp(radish_pct,  *ALLOC_LIMITS[CropType.RADISH])
    herb_pct    = _clamp(herb_pct,    *ALLOC_LIMITS[CropType.HERB])

    # ── Re-normalise so percentages always sum to exactly 1.0 ────────────────
    total = potato_pct + legume_pct + lettuce_pct + radish_pct + herb_pct
    potato_pct  /= total
    legume_pct  /= total
    lettuce_pct /= total
    radish_pct  /= total
    herb_pct    /= total

    return AreaAllocation(
        potato_pct  = round(potato_pct,  4),
        legume_pct  = round(legume_pct,  4),
        lettuce_pct = round(lettuce_pct, 4),
        radish_pct  = round(radish_pct,  4),
        herb_pct    = round(herb_pct,    4),
    )


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3 — SCHEDULE
# What gets planted or harvested today?
# ─────────────────────────────────────────────────────────────────────────────

def schedule(
    state: GreenhouseState,
    alloc: AreaAllocation,
    active_crops: dict[CropType, int],
    assessment: NutritionAssessment,
    profiles: dict[CropType, CropProfile],
) -> tuple[list[PlantingEvent], list[CropType]]:
    """
    Phase 3: decide what to plant and what to harvest today.

    Returns:
        planting_events  — list of PlantingEvent to start today
        harvest_events   — list of CropType ready to harvest today

    Harvest logic: if days_grown >= growth_cycle_days_min → harvest.
    Planting logic: if a crop zone has no active crop → plant immediately.

    The planter staggers crops so not everything matures on the same day.
    Radishes are always kept cycling (21-30 days) as an emergency buffer.
    """

    planting_events: list[PlantingEvent] = []
    harvest_events:  list[CropType]      = []

    for crop_type, plant_day in list(active_crops.items()):
        profile    = profiles[crop_type]
        days_grown = state.day - plant_day

        # ── Harvest check ────────────────────────────────────────────────────
        if days_grown >= profile.growth_cycle_days_min:
            harvest_events.append(crop_type)
            logger.info("Day %d: harvesting %s (grown %d days).", state.day, crop_type.value, days_grown)

    # ── Planting check ───────────────────────────────────────────────────────
    # For every crop type not currently active, start a new batch.
    # In the real system, main.py removes harvested crops from active_crops
    # before calling plan() again, so this naturally refills empty zones.

    currently_growing = set(active_crops.keys())

    for crop_type in CropType:
        if crop_type in currently_growing:
            continue  # already has an active batch — skip

        profile   = profiles[crop_type]
        alloc_pct = _alloc_pct_for(crop_type, alloc)
        area_m2   = state.total_area_m2 * alloc_pct

        if area_m2 < 0.5:
            continue  # not worth planting less than 0.5m²

        # Choose optimal setpoints from profile (midpoints of tolerance ranges)
        target_par  = (profile.par_min_umol  + profile.par_max_umol)  / 2
        target_temp = (profile.temp_min_celsius + profile.temp_max_celsius) / 2
        harvest_day = state.day + profile.growth_cycle_days_min

        event = PlantingEvent(
            day              = state.day,
            crop_type        = crop_type,
            area_m2          = round(area_m2, 2),
            expected_harvest_day = harvest_day,
            growth_system    = state.growth_system,
            target_par       = target_par,
            target_temp      = target_temp,
            target_co2_ppm   = 1000.0,   # optimal from doc 02: 800-1200 ppm
            target_ph        = 6.0,       # optimal from doc 02: 5.5-6.5
            notes            = f"Auto-planted on day {state.day}. "
                               f"Expected harvest: day {harvest_day}.",
        )
        planting_events.append(event)
        logger.info(
            "Day %d: planting %s on %.1fm² (harvest expected day %d).",
            state.day, crop_type.value, area_m2, harvest_day,
        )

    return planting_events, harvest_events


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 4 — STRESS RESPONSE
# Override the schedule if crops.py flagged problems
# ─────────────────────────────────────────────────────────────────────────────

def stress_respond(
    stress_reports: list[PlantStressReport],
    planting_events: list[PlantingEvent],
) -> tuple[list[PlantingEvent], list[PlantStressReport]]:
    """
    Phase 4: modify planting events or flag urgent actions
    in response to stress signals from the simulation layer.

    Priority hierarchy from doc 06:
      1. Human safety    (CO2 > 1500 ppm → halt all work, ventilate)
      2. System stability
      3. Crop survival
      4. Yield optimisation

    For each high-severity stress report, we adjust the relevant
    planting event's target setpoints to correct the stressor.
    Low-severity reports are logged but don't change the schedule.
    """

    actionable = [r for r in stress_reports if r.severity >= STRESS_OVERRIDE_THRESHOLD]

    for report in actionable:
        logger.warning(
            "Day %d: stress override — %s on %s (severity %.2f). Action: %s",
            report.day_detected,
            report.stress_type.value,
            report.crop_type.value,
            report.severity,
            report.recommended_action,
        )

        # Find the planting event for the affected crop and patch its setpoints
        for event in planting_events:
            if event.crop_type != report.crop_type:
                continue

            # ── Stress-specific setpoint corrections (from doc 04) ────────────
            if report.stress_type == StressType.HEAT:
                event.target_temp  = max(event.target_temp - 2.0, 15.0)
                event.notes       += " | STRESS: reduced temp target (heat stress)."

            elif report.stress_type == StressType.COLD:
                event.target_temp  = min(event.target_temp + 2.0, 25.0)
                event.notes       += " | STRESS: raised temp target (cold stress)."

            elif report.stress_type == StressType.LIGHT_LOW:
                event.target_par  = min(event.target_par + 30.0, 400.0)
                event.notes       += " | STRESS: raised PAR target (light deficiency)."

            elif report.stress_type == StressType.LIGHT_HIGH:
                event.target_par  = max(event.target_par - 30.0, 100.0)
                event.notes       += " | STRESS: reduced PAR target (light excess)."

            elif report.stress_type == StressType.CO2_HIGH:
                # Human safety — highest priority
                event.target_co2_ppm = 800.0
                event.notes         += " | STRESS: CRITICAL CO2 — ventilate immediately."

            elif report.stress_type == StressType.CO2_LOW:
                event.target_co2_ppm = min(event.target_co2_ppm + 100.0, 1200.0)
                event.notes         += " | STRESS: raised CO2 enrichment."

            elif report.stress_type in (StressType.NUTRIENT_N,
                                         StressType.NUTRIENT_K,
                                         StressType.NUTRIENT_FE):
                event.notes += f" | STRESS: {report.recommended_action}"

            elif report.stress_type in (StressType.WATER_DROUGHT,
                                         StressType.WATER_OVERWATER):
                event.notes += f" | STRESS: {report.recommended_action}"

    return planting_events, actionable


# ─────────────────────────────────────────────────────────────────────────────
# ORCHESTRATOR — plan()
# The single function called by main.py every day
# ─────────────────────────────────────────────────────────────────────────────

def plan(
    state: GreenhouseState,
    needs: CrewNutritionNeeds,
    active_crops: dict[CropType, int],
    stress_reports: list[PlantStressReport],
    current_alloc: AreaAllocation    = DEFAULT_ALLOC,
    rl_override: AreaAllocation | None = None,
    profiles: dict[CropType, CropProfile] | None = None,
) -> DailySchedule:
    """
    Main entry point.  Called once per simulated sol by main.py.

    Args:
        state          : live sensor snapshot from martian.py / resources.py
        needs          : crew nutritional targets (fixed for mission duration)
        active_crops   : dict[CropType → day_planted], maintained by main.py
        stress_reports : stress signals from crops.py simulation
        current_alloc  : last day's allocation (planner evolves from this)
        rl_override    : optional allocation computed by rl_agent.py
        profiles       : crop profiles (defaults to knowledge-base values)

    Returns:
        DailySchedule  : everything that should happen today
    """

    if profiles is None:
        profiles = default_crop_profiles()

    # ── Phase 1: Assess ──────────────────────────────────────────────────────
    assessment = assess(state, needs, active_crops, profiles)

    # ── Phase 2: Allocate ────────────────────────────────────────────────────
    alloc = allocate(assessment, current_alloc, rl_override)

    # ── Phase 3: Schedule ────────────────────────────────────────────────────
    planting_events, harvest_events = schedule(
        state, alloc, active_crops, assessment, profiles
    )

    # ── Phase 4: Stress response ─────────────────────────────────────────────
    planting_events, actionable_stress = stress_respond(stress_reports, planting_events)

    # ── Project today's nutrition output ─────────────────────────────────────
    projected_kcal    = assessment.calorie_coverage  * needs.kcal_per_day
    projected_protein = assessment.protein_coverage  * needs.protein_g_per_day

    # ── Estimate water usage (rough: 3L per m² per day in hydroponics) ───────
    water_used = state.total_area_m2 * 3.0

    daily_schedule = DailySchedule(
        day                    = state.day,
        area_allocation        = alloc,
        planting_events        = planting_events,
        harvest_events         = harvest_events,
        stress_responses       = actionable_stress,
        projected_kcal_today   = round(projected_kcal, 1),
        projected_protein_g_today = round(projected_protein, 1),
        water_used_liters      = round(water_used, 1),
        notes                  = _build_summary(assessment, actionable_stress),
    )

    logger.info(
        "Day %d plan complete | Planting: %d | Harvesting: %d | Stress overrides: %d",
        state.day,
        len(planting_events),
        len(harvest_events),
        len(actionable_stress),
    )

    return daily_schedule


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _build_summary(
    assessment: NutritionAssessment,
    stress: list[PlantStressReport],
) -> str:
    """Build a human-readable summary note for the frontend."""
    parts = []
    if assessment.calorie_deficit:
        parts.append(f"Calorie coverage low ({assessment.calorie_coverage:.0%}). Potato area increased.")
    if assessment.protein_deficit:
        parts.append(f"Protein coverage low ({assessment.protein_coverage:.0%}). Legume area increased.")
    if stress:
        crops_affected = ", ".join(r.crop_type.value for r in stress)
        parts.append(f"Stress overrides active on: {crops_affected}.")
    if not parts:
        parts.append("All systems nominal.")
    return " | ".join(parts)