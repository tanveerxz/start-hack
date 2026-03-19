"""
server/main.py

FastAPI application — the orchestrator that wires every backend file together.

This file has four jobs:
  1. STARTUP    — initialise all simulation state once at mission start
  2. SOL LOOP   — run the exact pipeline sequence for each simulated day
  3. ROUTES     — expose three clean API endpoints for the Next.js frontend
  4. HISTORY    — accumulate running totals for the mission summary panel

Pipeline sequence each sol (mirrors the workflow diagram exactly):
  martian.simulate_sol()       → GreenhouseState  (climate)
  crops.simulate_crops()       → SimulationResult (plant growth + stress)
  resources.update()           → GreenhouseState  (resource levels corrected)
  planner.plan()               → DailySchedule    (what to do today)
  reward.score()               → RewardSignal     (how well we did)
  agent.observe() + update()   → AgentState       (RL policy update)
  schemas.build_daily_response → DailyResponseSchema (JSON for frontend)

Run with:
  uvicorn main:app --reload --port 8000

Frontend hits:
  POST /api/step              → advance simulation by N sols
  GET  /api/sol/{day}         → retrieve a specific sol's result
  GET  /api/mission/summary   → mission overview running totals
  GET  /api/health            → liveness check
"""

from __future__ import annotations
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ── Our files — every import is a file we built ──────────────────────────────
from agent.models import (
    AreaAllocation,
    CrewNutritionNeeds,
    CropType,
    MarsEnvironment,
    default_crop_profiles,
)
from agent.planner import plan, DEFAULT_ALLOC
from agent.reward import score as reward_score
from agent.rl_agent import GreenhouseAgent, build_observation
from api.schemas import (
    DailyResponseSchema,
    MissionSummarySchema,
    SimStepRequestSchema,
    build_daily_response,
    build_mission_summary,
)
from environment.crops import simulate_crops
from environment.martian import simulate_sol, initial_greenhouse_state
from environment.resources import update as resources_update, initial_stock_tracker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# JOB 1 — MISSION STATE
# Everything that exists for the full 450-sol mission.
# Initialised once at startup, mutated each sol by run_one_sol().
#
# Why module-level globals here and not a class:
#   FastAPI's lifespan context runs once at startup.
#   A class would add indirection with no benefit in a single-process server.
#   The state is effectively a singleton — one mission, one server process.
# ─────────────────────────────────────────────────────────────────────────────

# Fixed mission parameters — never change after startup
MISSION_DURATION = 450
CREW_SIZE        = 4

# Mars physical constants (from models.py — doc 01 values)
mars_env = MarsEnvironment()

# Crew nutritional targets (from models.py — doc 05 values)
crew_needs = CrewNutritionNeeds(
    crew_size             = CREW_SIZE,
    mission_duration_days = MISSION_DURATION,
)

# Crop knowledge base — the 5 profiles from doc 03
crop_profiles = default_crop_profiles()

# ── Mutable simulation state — changes every sol ─────────────────────────────

# greenhouse_state: the live sensor snapshot.
# Starts at optimal setpoints (martian.initial_greenhouse_state).
# Updated each sol by martian.simulate_sol() then resources.update().
greenhouse_state = initial_greenhouse_state(total_area_m2=100.0)

# active_crops: tracks every crop batch currently growing.
# Structure: { CropType → {"day_planted": int, "area_m2": float,
#                           "cumulative_growth": float} }
# main.py adds entries when planner schedules planting events.
# main.py removes entries when crops are ready to harvest.
# crops.py mutates the "cumulative_growth" field each sol.
active_crops: dict[CropType, dict] = {}

# current_allocation: the area split decided last sol.
# Starts at the rule-based default from planner.py.
# Updated each sol to whatever planner/RL agent decided.
current_allocation: AreaAllocation = DEFAULT_ALLOC

# stock_tracker: finite nutrient reserves from resources.py.
# Tracks cumulative usage of N, K, Fe across all sols.
# Also holds recycling_efficiency (degrades with failure events).
stock_tracker = initial_stock_tracker()

# ── RL Agent ──────────────────────────────────────────────────────────────────
# Single agent instance — persists across sols, checkpoints to disk.
# Warmup for first 10 sols, then takes over from rule-based planner.
agent = GreenhouseAgent(
    checkpoint_path=os.path.join("data", "agent_checkpoint.json")
)

# ── History — accumulated across sols for mission summary ─────────────────────
# main.py appends to these each sol.
# build_mission_summary() reads them to compute running averages.
sol_history:         list[DailyResponseSchema] = []   # full payload per sol
reward_history:      list[float] = []                  # reward.total per sol
calorie_history:     list[float] = []                  # calorie_coverage per sol
recycling_history:   list[float] = []                  # recycling_ratio per sol
cumulative_kcal:     float = 0.0
cumulative_protein:  float = 0.0
cumulative_water_recycled: float = 0.0
cumulative_yield_kg: float = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# JOB 2 — THE SOL LOOP
# run_one_sol() is the heart of the system.
# Runs the exact pipeline sequence from the workflow diagram.
# Called by the /api/step route handler below.
# ─────────────────────────────────────────────────────────────────────────────

def run_one_sol() -> DailyResponseSchema:
    """
    Advance the simulation by one sol (Martian day).
    Mutates all global state variables and appends to history.
    Returns the full DailyResponseSchema payload for the frontend.

    Every line here maps to a node in the workflow diagram.
    """
    global greenhouse_state, current_allocation
    global cumulative_kcal, cumulative_protein
    global cumulative_water_recycled, cumulative_yield_kg

    logger.info("════════════════ SOL %d ════════════════", greenhouse_state.day + 1)

    # ── STEP 1: martian.py — atmospheric simulation ───────────────────────────
    # Takes yesterday's GreenhouseState, applies Mars-driven drifts
    # (temperature swings, dust storms, CO2 leakage) and greenhouse
    # control systems (HVAC, LEDs, CO2 injectors).
    # Returns today's climate snapshot — temp, CO2, PAR, humidity.
    #
    # Why first: everything else reads the environment.
    # planner, crops, and resources all need today's climate before they run.
    greenhouse_state = simulate_sol(greenhouse_state, mars_env)

    # ── STEP 2: crops.py — plant growth simulation ────────────────────────────
    # Takes today's GreenhouseState + active_crops dict.
    # For each growing crop, computes:
    #   - growth_rate using Liebig's Law of the Minimum
    #   - stress detection across all 7 abiotic stress categories
    #   - yield projection based on cumulative growth
    # Mutates active_crops["cumulative_growth"] in place.
    # Returns SimulationResult with stress reports + nutrition projections.
    #
    # Why second: needs the climate martian.py just produced.
    # Its stress reports feed into planner.py's stress_respond() phase.
    sim_result = simulate_crops(
        state        = greenhouse_state,
        active_crops = active_crops,
        profiles     = crop_profiles,
    )

    # ── STEP 3: resources.py — water, nutrients, power ───────────────────────
    # Takes what crops.py said was consumed + current GreenhouseState.
    # Runs the 6-step resource update:
    #   deduct → recycle → extract ice → replenish nutrients → pH/EC → critical check
    # Returns updated GreenhouseState (with corrected nutrient/water levels)
    # and ResourceStatus (recycling ratio, stock levels, critical flags).
    #
    # Why third: needs crops.py's consumption figures.
    # Updates greenhouse_state so planner sees accurate resource levels.
    # ResourceStatus flows into reward.py and schemas.py.
    greenhouse_state, resource_status = resources_update(
        state                    = greenhouse_state,
        water_consumed_liters    = sim_result.water_consumed_liters,
        nutrient_n_consumed_ppm  = sim_result.nutrient_n_consumed_ppm,
        nutrient_k_consumed_ppm  = sim_result.nutrient_k_consumed_ppm,
        n_stock_used             = stock_tracker["n_stock_used"],
        k_stock_used             = stock_tracker["k_stock_used"],
        fe_stock_used            = stock_tracker["fe_stock_used"],
        recycling_efficiency     = stock_tracker["recycling_efficiency"],
    )

    # Update stock tracker with what resources.py consumed this sol
    # (resources.py returns updated totals inside resource_status)
    stock_tracker["n_stock_used"]  += resource_status.n_dosed_ppm
    stock_tracker["k_stock_used"]  += resource_status.k_dosed_ppm
    stock_tracker["fe_stock_used"] += resource_status.fe_dosed_ppm

    # ── STEP 4: rl_agent.py observe() — agent reads state ────────────────────
    # Build the normalised 6-feature observation vector from this sol's outputs.
    # Agent proposes an AreaAllocation override for the planner.
    # During warmup (sols 0-9): returns current_allocation unchanged.
    # After warmup: linear policy computes adjustments + exploration noise.
    #
    # Why before planner: planner.plan() accepts rl_override as a parameter.
    # The agent's proposed allocation goes straight into that argument.
    observation = build_observation(
        sim           = sim_result,
        res           = resource_status,
        needs_kcal    = crew_needs.kcal_per_day,
        needs_protein = crew_needs.protein_g_per_day,
        mission_duration = MISSION_DURATION,
    )
    rl_allocation = agent.observe(observation, current_allocation)

    # ── STEP 5: planner.py — daily schedule ──────────────────────────────────
    # The planning brain. Four phases:
    #   assess()        → what does the crew need nutritionally?
    #   allocate()      → adjust floor space (uses rl_allocation as override)
    #   schedule()      → what gets planted / harvested today?
    #   stress_respond()→ override setpoints for stressed crops
    # Returns DailySchedule — the complete plan for today.
    #
    # Why here: needs climate (martian), stress reports (crops),
    # resource levels (resources), and RL override (agent). All ready now.
    #
    # active_crops passed as simple {CropType: day_planted} dict
    # so planner.py doesn't need to know about the richer dict structure.
    simple_active = {ct: data["day_planted"] for ct, data in active_crops.items()}

    daily_schedule = plan(
        state          = greenhouse_state,
        needs          = crew_needs,
        active_crops   = simple_active,
        stress_reports = sim_result.all_stress_reports,
        current_alloc  = current_allocation,
        rl_override    = rl_allocation,
        profiles       = crop_profiles,
    )

    # Update current_allocation to what planner decided
    current_allocation = daily_schedule.area_allocation

    # ── Apply planting events to active_crops ─────────────────────────────────
    # Planner said to plant these crops today — add them to active_crops.
    # main.py owns this dict; planner just says what to do.
    for event in daily_schedule.planting_events:
        active_crops[event.crop_type] = {
            "day_planted":       event.day,
            "area_m2":           event.area_m2,
            "cumulative_growth": 0.0,
        }
        logger.info(
            "Planted %s: %.1fm² (harvest expected sol %d)",
            event.crop_type.value, event.area_m2, event.expected_harvest_day,
        )

    # ── Apply harvest events — remove from active_crops ───────────────────────
    # Planner said these crops are ready — harvest and clear the zone.
    # Next sol's schedule() will replant the empty zone automatically.
    for crop_type in daily_schedule.harvest_events:
        if crop_type in active_crops:
            harvested_data = active_crops.pop(crop_type)
            logger.info(
                "Harvested %s after %d days grown.",
                crop_type.value,
                greenhouse_state.day - harvested_data["day_planted"],
            )

    # ── STEP 6: reward.py — score this sol ───────────────────────────────────
    # Combines four components into a single scalar reward in [-1, 1]:
    #   nutrition_score  (40%) — calorie + protein coverage
    #   efficiency_score (30%) — water recycling + nutrient conservation
    #   stress_score     (20%) — plant health
    #   critical_score   (10%) — hard safety floor
    # Returns RewardSignal with full breakdown for agent and frontend.
    #
    # Why here: needs all simulation outputs. Nothing upstream of this
    # point needs the reward — it's pure scoring, not decision-making.
    reward_signal = reward_score(
        sim      = sim_result,
        res      = resource_status,
        schedule = daily_schedule,
        needs    = crew_needs,
    )

    # ── STEP 7: rl_agent.py update_policy() — agent learns ───────────────────
    # REINFORCE gradient update: weights += lr × reward × state
    # Positive reward reinforces this sol's allocation decisions.
    # Negative reward reverses them.
    # Decays learning rate, saves checkpoint every 10 sols.
    # Returns AgentState for schemas.py to serialise.
    #
    # Why last in the agent sequence: needs the reward signal to learn from.
    agent_state = agent.update_policy(reward_signal)

    # ── STEP 8: schemas.py — build the API response ───────────────────────────
    # Translates all backend dataclasses into one clean JSON payload.
    # This is what the Next.js frontend receives.
    payload = build_daily_response(
        schedule          = daily_schedule,
        sim               = sim_result,
        res               = resource_status,
        agent_state       = agent_state,
        reward            = reward_signal,
        env               = greenhouse_state,
        needs_kcal        = crew_needs.kcal_per_day,
        needs_protein     = crew_needs.protein_g_per_day,
        mission_duration  = MISSION_DURATION,
    )

    # ── STEP 9: Accumulate history ────────────────────────────────────────────
    # Running totals that build_mission_summary() reads.
    # Appended after the payload is built so history is consistent.
    sol_history.append(payload)
    reward_history.append(reward_signal.total)
    calorie_history.append(payload.nutrition.calorie_coverage_pct / 100.0)
    recycling_history.append(payload.resources.recycling_ratio)

    cumulative_kcal            += sim_result.total_projected_kcal
    cumulative_protein         += sim_result.total_projected_protein_g
    cumulative_water_recycled  += resource_status.water_recycled_liters
    cumulative_yield_kg        += sim_result.total_projected_yield_kg

    logger.info(
        "Sol %d complete | reward=%.4f | kcal=%.0f | recycling=%.0f%% | agent_sol=%d",
        greenhouse_state.day,
        reward_signal.total,
        sim_result.total_projected_kcal,
        payload.resources.recycling_ratio * 100,
        agent_state.total_sols_trained,
    )

    return payload


# ─────────────────────────────────────────────────────────────────────────────
# JOB 3 — FASTAPI APPLICATION + ROUTES
# Three endpoints the Next.js frontend needs.
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs once at server startup.
    Seeds the first sol so the frontend has data immediately on load
    rather than showing an empty dashboard.
    """
    logger.info("Mars greenhouse server starting — mission duration: %d sols.", MISSION_DURATION)
    os.makedirs("data", exist_ok=True)

    # Run sol 0 immediately so frontend has something to show
    if not sol_history:
        run_one_sol()
        logger.info("Sol 0 seeded. Server ready.")

    yield
    logger.info("Server shutting down.")


app = FastAPI(
    title       = "Mars Greenhouse API",
    description = "Autonomous greenhouse management for the Syngenta START HACK 2026 challenge.",
    version     = "1.0.0",
    lifespan    = lifespan,
)

# ── CORS — allow the Next.js dev server to call this API ─────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:3000", "http://localhost:3001"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


@app.post("/api/step", response_model=DailyResponseSchema)
async def step_simulation(request: SimStepRequestSchema):
    """
    Advance the simulation by N sols (default 1, max 50).

    POST /api/step
    Body: { "n_sols": 1 }

    Returns the payload from the LAST sol stepped.
    Frontend uses this to advance the simulation and update the dashboard.

    The "Run N sols" demo button hits this endpoint.
    For N > 1, intermediate sols are stored in sol_history but only
    the final sol's payload is returned — keeps the response size small.
    """
    if greenhouse_state.day >= MISSION_DURATION:
        raise HTTPException(
            status_code = 400,
            detail      = f"Mission complete at sol {MISSION_DURATION}. Reset to restart.",
        )

    last_payload = None
    for _ in range(request.n_sols):
        if greenhouse_state.day >= MISSION_DURATION:
            break
        last_payload = run_one_sol()

    return last_payload


@app.get("/api/sol/{day}", response_model=DailyResponseSchema)
async def get_sol(day: int):
    """
    Retrieve the stored payload for a specific sol.

    GET /api/sol/42

    Used by the frontend timeline scrubber — lets the user
    look back at any previous sol's state without re-running the sim.
    sol_history[0] is sol 1 (sol 0 is seeded at startup).
    """
    if day < 1 or day > len(sol_history):
        raise HTTPException(
            status_code = 404,
            detail      = f"Sol {day} not found. Simulation has run {len(sol_history)} sols.",
        )
    return sol_history[day - 1]


@app.get("/api/mission/summary", response_model=MissionSummarySchema)
async def get_mission_summary():
    """
    Mission overview — running totals and averages since sol 0.

    GET /api/mission/summary

    Used by the frontend overview panel / header stats.
    Returns cumulative kcal, water recycled, average reward trend,
    current allocation, agent performance, and mission status flag.
    """
    if not sol_history:
        raise HTTPException(status_code=404, detail="No sols run yet.")

    return build_mission_summary(
        current_day              = greenhouse_state.day,
        mission_duration         = MISSION_DURATION,
        cumulative_kcal          = cumulative_kcal,
        cumulative_protein_g     = cumulative_protein,
        cumulative_water_l       = cumulative_water_recycled,
        cumulative_yield_kg      = cumulative_yield_kg,
        reward_history           = reward_history,
        calorie_history          = calorie_history,
        recycling_history        = recycling_history,
        current_allocation       = current_allocation,
        agent_sols_trained       = agent.sols_trained,
        agent_cumulative_reward  = agent.cumulative_reward,
        any_critical_today       = sol_history[-1].resources.any_critical,
    )


@app.get("/api/health")
async def health():
    """
    Liveness check.
    GET /api/health → { "status": "ok", "sol": 42 }
    Frontend polls this to confirm the server is alive.
    """
    return {
        "status":          "ok",
        "sol":             greenhouse_state.day,
        "sols_remaining":  MISSION_DURATION - greenhouse_state.day,
        "agent_trained":   agent.sols_trained,
    }