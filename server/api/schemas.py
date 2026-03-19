"""
server/api/schemas.py

Pydantic schemas — the contract between backend and Next.js frontend.
Translates all backend dataclasses into clean, validated JSON shapes.

Responsibility:
  - Define the exact JSON shape for every API response
  - Validate all outgoing data (Pydantic does this automatically)
  - Provide a single builder function per response type that main.py calls
  - Nothing here contains business logic — pure translation layer

Three response types:
  DailyResponseSchema    → main payload, polled by frontend each sol
  MissionSummarySchema   → overview panel, lightweight running totals
  StressAlertSchema      → flat list of active stress events

Why Pydantic:
  - Automatic JSON serialisation (.model_dump_json())
  - Runtime validation — if reward.py produces a NaN, Pydantic catches it
  - Auto-generates OpenAPI docs at /docs — frontend dev can read the
    exact shape without asking us
  - model_config allows extra fields to pass through safely

What main.py does with these:
  from api.schemas import build_daily_response
  payload = build_daily_response(schedule, sim, res, agent_state, reward, state)
  return payload   # FastAPI serialises directly

Feeds into:
  main.py      ← builder functions
  Next.js      ← JSON over HTTP (FastAPI routes defined in main.py)
"""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field, model_validator

from agent.models import (
    AreaAllocation,
    CropType,
    DailySchedule,
    GreenhouseState,
    GrowthSystem,
    PlantingEvent,
    PlantStressReport,
)
from agent.reward import RewardSignal
from agent.rl_agent import AgentState
from environment.crops import CropStatus, SimulationResult
from environment.resources import ResourceStatus


# ─────────────────────────────────────────────────────────────────────────────
# SUB-SCHEMAS
# Small reusable shapes that compose into the main response schemas
# ─────────────────────────────────────────────────────────────────────────────

class EnvironmentSchema(BaseModel):
    """
    Current greenhouse sensor readings.
    Maps directly from GreenhouseState.
    Frontend: environment panel showing live conditions.
    """
    day:                    int
    temp_celsius:           float
    humidity_rh:            float
    co2_ppm:                float
    par_umol_m2s:           float
    ph:                     float
    ec_ms_cm:               float
    water_liters_available: float
    power_kwh_available:    float
    growth_system:          str


class AllocationSchema(BaseModel):
    """
    Current floor space allocation across the 5 crop types.
    Shown as percentages in the frontend allocation chart.
    """
    potato_pct:  float
    legume_pct:  float
    lettuce_pct: float
    radish_pct:  float
    herb_pct:    float


class PlantingEventSchema(BaseModel):
    """
    A single planting action scheduled for today.
    Frontend: timeline / schedule card.
    """
    crop_type:            str
    area_m2:              float
    expected_harvest_day: int
    growth_system:        str
    target_par:           float
    target_temp:          float
    target_co2_ppm:       float
    target_ph:            float
    notes:                str


class CropStatusSchema(BaseModel):
    """
    How a specific crop batch performed today.
    Frontend: per-crop health cards.
    """
    crop_type:              str
    days_grown:             int
    growth_rate_today:      float   # 0-1 — Liebig minimum from crops.py
    cumulative_growth:      float
    projected_yield_kg_m2:  float
    is_stressed:            bool
    days_to_min_harvest:    int
    ready_to_harvest:       bool
    stress_count:           int     # number of active stress reports


class StressAlertSchema(BaseModel):
    """
    A single stress event. Also used as the list item in the
    alerts endpoint and embedded in DailyResponseSchema.
    Frontend: alert banner / notification panel.
    """
    crop_type:          str
    stress_type:        str
    severity:           float   # 0-1
    recommended_action: str
    day_detected:       int


class ResourceSchema(BaseModel):
    """
    Resource levels and recycling performance.
    Frontend: resource dashboard panel (water gauge, nutrient bars).
    This is the Syngenta efficiency story — recycling_ratio is the
    key metric the judges want to see.
    """
    water_available_liters:  float
    water_consumed_liters:   float
    water_recycled_liters:   float
    water_extracted_liters:  float
    recycling_ratio:         float   # recycled / consumed — the headline metric
    water_critical:          bool

    nutrient_n_ppm:          float
    nutrient_k_ppm:          float
    nutrient_fe_ppm:         float
    nutrients_critical:      bool

    ph:                      float
    ec_ms_cm:                float

    n_stock_remaining_pct:   float   # fraction of mission N budget remaining
    k_stock_remaining_pct:   float
    fe_stock_remaining_pct:  float

    any_critical:            bool


class RewardSchema(BaseModel):
    """
    Reward breakdown for this sol.
    Frontend: reward chart — shows judges exactly how the agent is scored.
    The component breakdown is intentionally visible — transparency is
    part of the Syngenta pitch (explainable AI for agriculture).
    """
    total:                    float   # [-1, 1] — the RL signal
    nutrition_score:          float   # [0, 1]
    efficiency_score:         float   # [0, 1]
    stress_score:             float   # [0, 1]
    critical_score:           float   # 0 or 1
    nutrition_contribution:   float
    efficiency_contribution:  float
    stress_contribution:      float
    critical_contribution:    float
    nutrition_note:           str
    efficiency_note:          str
    stress_note:              str
    critical_note:            str


class AgentSchema(BaseModel):
    """
    RL agent state for this sol.
    Frontend: agent panel — shows what the agent decided and why.
    This is the "explainability" part of the demo.

    raw_adjustments: what the policy matrix output (before clamping)
    proposed_allocation: what actually got sent to planner
    in_warmup: whether rule-based or RL is in control
    """
    sols_trained:            int
    in_warmup:               bool
    learning_rate:           float
    reward_received:         float
    cumulative_reward:       float
    recent_avg_reward:       Optional[float] = None

    # What the agent observed (the 6-feature state vector)
    calorie_coverage:        float
    protein_coverage:        float
    water_reserve_frac:      float
    avg_stress:              float
    nutrient_stock_frac:     float
    day_fraction:            float

    # What it decided
    raw_adjustments:         list[float]   # 5 values, one per crop
    proposed_allocation:     AllocationSchema


class NutritionSchema(BaseModel):
    """
    Nutrition output for this sol.
    Frontend: nutrition panel showing calorie and protein coverage bars.

    harvested_kcal / harvested_protein_g — actual food produced today.
      Zero on non-harvest days. Real number on harvest days.
      Use these for the daily nutrition bars.

    calorie_coverage_pct / protein_coverage_pct — 30-sol rolling average.
      Shows the trend: is the greenhouse keeping up with crew needs over time?
      This is what the reward system scores against.

    standing_crop_kcal — what the entire field is worth right now.
      Use this for the forecast feature only.
    """
    harvested_kcal:          float   # food actually produced today
    harvested_protein_g:     float   # protein actually produced today
    calorie_coverage_pct:    float   # 30-sol rolling avg vs 12000 kcal target
    protein_coverage_pct:    float   # 30-sol rolling avg vs 450g target
    total_yield_kg:          float   # total field yield today
    standing_crop_kcal:      float   # entire field value (for forecasting)
    is_harvest_day:          bool    # true if any crop was harvested today


# ─────────────────────────────────────────────────────────────────────────────
# MAIN RESPONSE SCHEMAS
# These are what the FastAPI routes in main.py return directly
# ─────────────────────────────────────────────────────────────────────────────

class DailyResponseSchema(BaseModel):
    """
    The main API payload — returned every sol.
    Frontend polls this at /api/sol/{day} or via WebSocket.

    Contains everything the dashboard needs in one request:
    - What happened today (schedule, harvest, stress)
    - Current state (environment, resources)
    - How the agent scored and what it learned
    - What the agent is doing next

    Designed so the frontend never needs to call multiple endpoints
    to render the main dashboard — one payload, complete picture.
    """
    day:              int
    environment:      EnvironmentSchema
    allocation:       AllocationSchema
    nutrition:        NutritionSchema
    resources:        ResourceSchema
    reward:           RewardSchema
    agent:            AgentSchema

    # Today's actions
    planting_events:  list[PlantingEventSchema]
    harvest_events:   list[str]              # list of crop_type strings
    stress_alerts:    list[StressAlertSchema]

    # Crop-by-crop performance
    crop_statuses:    list[CropStatusSchema]

    # Human-readable summary for the dashboard header
    summary:          str
    mission_day:      int
    days_remaining:   int

    model_config = {"extra": "ignore"}


class MissionSummarySchema(BaseModel):
    """
    Lightweight mission overview — running totals since sol 0.
    Frontend: mission overview panel / header stats.
    Computed by main.py from accumulated history, not from a single sol.
    """
    current_day:              int
    days_remaining:           int
    mission_duration:         int

    # Cumulative totals
    total_kcal_produced:      float
    total_protein_produced_g: float
    total_water_recycled_l:   float
    total_yield_kg:           float

    # Running averages
    avg_daily_reward:         float
    avg_calorie_coverage_pct: float
    avg_recycling_ratio_pct:  float

    # Current allocation snapshot
    current_allocation:       AllocationSchema

    # Agent performance
    agent_sols_trained:       int
    agent_cumulative_reward:  float

    # Mission health — overall flag
    mission_status:           str   # "nominal" | "caution" | "critical"


class SimStepRequestSchema(BaseModel):
    """
    Request body for POST /api/step — advance the simulation by N sols.
    Frontend: "Run N sols" button on the dashboard.
    Lets the user fast-forward the simulation for demo purposes.
    """
    n_sols: int = Field(default=1, ge=1, le=50)
    seed:   Optional[int] = None


# ─────────────────────────────────────────────────────────────────────────────
# BUILDER FUNCTIONS
# The only things main.py needs to import from this file
# ─────────────────────────────────────────────────────────────────────────────

def build_daily_response(
    schedule:     DailySchedule,
    sim:          SimulationResult,
    res:          ResourceStatus,
    agent_state:  AgentState,
    reward:       RewardSignal,
    env:          GreenhouseState,
    needs_kcal:   float = 12000.0,
    needs_protein: float = 450.0,
    mission_duration: int = 450,
) -> DailyResponseSchema:
    """
    Main builder — called by main.py once per sol.
    Assembles all backend outputs into a single DailyResponseSchema.

    All conversion logic lives here — the route handler in main.py
    just calls this and returns the result.
    """

    # ── Environment ───────────────────────────────────────────────────────────
    environment = EnvironmentSchema(
        day                    = env.day,
        temp_celsius           = env.temp_celsius,
        humidity_rh            = env.humidity_rh,
        co2_ppm                = env.co2_ppm,
        par_umol_m2s           = env.par_umol_m2s,
        ph                     = env.ph,
        ec_ms_cm               = env.ec_ms_cm,
        water_liters_available = env.water_liters_available,
        power_kwh_available    = env.power_kwh_available,
        growth_system          = env.growth_system.value,
    )

    # ── Allocation ────────────────────────────────────────────────────────────
    allocation = AllocationSchema(
        potato_pct  = schedule.area_allocation.potato_pct,
        legume_pct  = schedule.area_allocation.legume_pct,
        lettuce_pct = schedule.area_allocation.lettuce_pct,
        radish_pct  = schedule.area_allocation.radish_pct,
        herb_pct    = schedule.area_allocation.herb_pct,
    )

    # ── Nutrition ─────────────────────────────────────────────────────────────
    # 30-sol rolling average from reward.py history
    from agent.reward import harvest_kcal_history, harvest_protein_history
    window = 30
    recent_kcal    = harvest_kcal_history[-window:]
    recent_protein = harvest_protein_history[-window:]
    avg_kcal    = sum(recent_kcal)    / len(recent_kcal)    if recent_kcal    else 0.0
    avg_protein = sum(recent_protein) / len(recent_protein) if recent_protein else 0.0

    nutrition = NutritionSchema(
        harvested_kcal       = sim.daily_harvested_kcal,
        harvested_protein_g  = sim.daily_harvested_protein_g,
        calorie_coverage_pct = round(min(avg_kcal    / needs_kcal,    1.0) * 100, 1),
        protein_coverage_pct = round(min(avg_protein / needs_protein, 1.0) * 100, 1),
        total_yield_kg       = sim.total_projected_yield_kg,
        standing_crop_kcal   = sim.standing_crop_kcal,
        is_harvest_day       = sim.daily_harvested_kcal > 0,
    )

    # ── Resources ─────────────────────────────────────────────────────────────
    recycling_ratio = (
        res.water_recycled_liters / res.water_consumed_liters
        if res.water_consumed_liters > 0 else 1.0
    )
    resources = ResourceSchema(
        water_available_liters  = res.water_available_liters,
        water_consumed_liters   = res.water_consumed_liters,
        water_recycled_liters   = res.water_recycled_liters,
        water_extracted_liters  = res.water_extracted_liters,
        recycling_ratio         = round(recycling_ratio, 3),
        water_critical          = res.water_critical,
        nutrient_n_ppm          = res.nutrient_n_ppm,
        nutrient_k_ppm          = res.nutrient_k_ppm,
        nutrient_fe_ppm         = res.nutrient_fe_ppm,
        nutrients_critical      = res.nutrients_critical,
        ph                      = res.ph,
        ec_ms_cm                = res.ec_ms_cm,
        n_stock_remaining_pct   = res.n_stock_remaining_pct,
        k_stock_remaining_pct   = res.k_stock_remaining_pct,
        fe_stock_remaining_pct  = res.fe_stock_remaining_pct,
        any_critical            = res.any_critical,
    )

    # ── Reward ────────────────────────────────────────────────────────────────
    reward_schema = RewardSchema(
        total                   = reward.total,
        nutrition_score         = reward.nutrition_score,
        efficiency_score        = reward.efficiency_score,
        stress_score            = reward.stress_score,
        critical_score          = reward.critical_score,
        nutrition_contribution  = reward.nutrition_contribution,
        efficiency_contribution = reward.efficiency_contribution,
        stress_contribution     = reward.stress_contribution,
        critical_contribution   = reward.critical_contribution,
        nutrition_note          = reward.nutrition_note,
        efficiency_note         = reward.efficiency_note,
        stress_note             = reward.stress_note,
        critical_note           = reward.critical_note,
    )

    # ── Agent ─────────────────────────────────────────────────────────────────
    obs = agent_state.observation
    agent_schema = AgentSchema(
        sols_trained         = agent_state.total_sols_trained,
        in_warmup            = agent_state.in_warmup,
        learning_rate        = agent_state.learning_rate,
        reward_received      = agent_state.reward_received,
        cumulative_reward    = agent_state.cumulative_reward,
        calorie_coverage     = obs.calorie_coverage    if obs else 0.0,
        protein_coverage     = obs.protein_coverage    if obs else 0.0,
        water_reserve_frac   = obs.water_reserve_frac  if obs else 0.0,
        avg_stress           = obs.avg_stress           if obs else 0.0,
        nutrient_stock_frac  = obs.nutrient_stock_frac  if obs else 0.0,
        day_fraction         = obs.day_fraction         if obs else 0.0,
        raw_adjustments      = agent_state.raw_adjustments,
        recent_avg_reward    = agent_state.recent_avg_reward,
        proposed_allocation  = AllocationSchema(
            potato_pct  = agent_state.proposed_allocation.potato_pct,
            legume_pct  = agent_state.proposed_allocation.legume_pct,
            lettuce_pct = agent_state.proposed_allocation.lettuce_pct,
            radish_pct  = agent_state.proposed_allocation.radish_pct,
            herb_pct    = agent_state.proposed_allocation.herb_pct,
        ),
    )

    # ── Planting events ───────────────────────────────────────────────────────
    planting = [
        PlantingEventSchema(
            crop_type            = e.crop_type.value,
            area_m2              = e.area_m2,
            expected_harvest_day = e.expected_harvest_day,
            growth_system        = e.growth_system.value,
            target_par           = e.target_par,
            target_temp          = e.target_temp,
            target_co2_ppm       = e.target_co2_ppm,
            target_ph            = e.target_ph,
            notes                = e.notes,
        )
        for e in schedule.planting_events
    ]

    # ── Stress alerts ─────────────────────────────────────────────────────────
    alerts = [
        StressAlertSchema(
            crop_type          = r.crop_type.value,
            stress_type        = r.stress_type.value,
            severity           = r.severity,
            recommended_action = r.recommended_action,
            day_detected       = r.day_detected,
        )
        for r in sim.all_stress_reports
    ]

    # ── Crop statuses ─────────────────────────────────────────────────────────
    crop_statuses = [
        CropStatusSchema(
            crop_type              = cs.crop_type.value,
            days_grown             = cs.days_grown,
            growth_rate_today      = cs.growth_rate_today,
            cumulative_growth      = cs.cumulative_growth,
            projected_yield_kg_m2  = cs.projected_yield_kg_m2,
            is_stressed            = cs.is_stressed,
            days_to_min_harvest    = cs.days_to_min_harvest,
            ready_to_harvest       = cs.ready_to_harvest,
            stress_count           = len(cs.stress_reports),
        )
        for cs in sim.crop_statuses
    ]

    # ── Summary string ────────────────────────────────────────────────────────
    summary = _build_summary(nutrition, resources, reward_schema, agent_state)

    return DailyResponseSchema(
        day              = env.day,
        environment      = environment,
        allocation       = allocation,
        nutrition        = nutrition,
        resources        = resources,
        reward           = reward_schema,
        agent            = agent_schema,
        planting_events  = planting,
        harvest_events   = [c.value for c in schedule.harvest_events],
        stress_alerts    = alerts,
        crop_statuses    = crop_statuses,
        summary          = summary,
        mission_day      = env.day,
        days_remaining   = max(mission_duration - env.day, 0),
    )


def build_mission_summary(
    current_day:           int,
    mission_duration:      int,
    cumulative_kcal:       float,
    cumulative_protein_g:  float,
    cumulative_water_l:    float,
    cumulative_yield_kg:   float,
    reward_history:        list[float],
    calorie_history:       list[float],
    recycling_history:     list[float],
    current_allocation:    AreaAllocation,
    agent_sols_trained:    int,
    agent_cumulative_reward: float,
    any_critical_today:    bool,
) -> MissionSummarySchema:
    """
    Builder for the mission overview panel.
    Called by main.py on demand (GET /api/mission/summary).
    All history lists are maintained by main.py across sols.
    """
    avg_reward   = sum(reward_history)   / len(reward_history)   if reward_history   else 0.0
    avg_calorie  = sum(calorie_history)  / len(calorie_history)  if calorie_history  else 0.0
    avg_recycling = sum(recycling_history) / len(recycling_history) if recycling_history else 0.0

    # Mission status — simple three-level flag
    if any_critical_today:
        status = "critical"
    elif avg_reward < 0.0:
        status = "caution"
    else:
        status = "nominal"

    return MissionSummarySchema(
        current_day              = current_day,
        days_remaining           = max(mission_duration - current_day, 0),
        mission_duration         = mission_duration,
        total_kcal_produced      = round(cumulative_kcal, 1),
        total_protein_produced_g = round(cumulative_protein_g, 1),
        total_water_recycled_l   = round(cumulative_water_l, 1),
        total_yield_kg           = round(cumulative_yield_kg, 2),
        avg_daily_reward         = round(avg_reward, 4),
        avg_calorie_coverage_pct = round(avg_calorie * 100, 1),
        avg_recycling_ratio_pct  = round(avg_recycling * 100, 1),
        current_allocation       = AllocationSchema(
            potato_pct  = current_allocation.potato_pct,
            legume_pct  = current_allocation.legume_pct,
            lettuce_pct = current_allocation.lettuce_pct,
            radish_pct  = current_allocation.radish_pct,
            herb_pct    = current_allocation.herb_pct,
        ),
        agent_sols_trained       = agent_sols_trained,
        agent_cumulative_reward  = round(agent_cumulative_reward, 2),
        mission_status           = status,
    )


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _build_summary(
    nutrition: NutritionSchema,
    resources: ResourceSchema,
    reward:    RewardSchema,
    agent:     AgentState,
) -> str:
    """One-line human-readable summary for the dashboard header."""
    parts = []

    if nutrition.calorie_coverage_pct < 85:
        parts.append(f"Calorie deficit ({nutrition.calorie_coverage_pct:.0f}%)")
    else:
        parts.append(f"Nutrition OK ({nutrition.calorie_coverage_pct:.0f}% kcal)")

    if resources.any_critical:
        parts.append("CRITICAL resource alert")
    elif resources.recycling_ratio < 0.7:
        parts.append(f"Low recycling ({resources.recycling_ratio:.0%})")

    parts.append(f"Reward: {reward.total:+.3f}")

    if agent.in_warmup:
        parts.append("Agent: warmup")
    else:
        parts.append(f"Agent: sol {agent.total_sols_trained} trained")

    return " | ".join(parts)