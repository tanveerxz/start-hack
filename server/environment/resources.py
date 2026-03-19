"""
server/environment/resources.py

Closed-loop resource management for the Mars greenhouse.
Runs once per simulated sol, AFTER crops.py has computed consumption.

Responsibility:
  - Deduct water and nutrients consumed by crops today
  - Model closed-loop water recycling (transpiration recovery + crew greywater)
  - Model nutrient replenishment from stored mission supplies
  - Manage pH and EC correction (nutrient solution quality)
  - Track stored reserves and flag critical shortfalls
  - Return an updated GreenhouseState with corrected resource levels

Why this matters for Syngenta:
  On Mars, every molecule of water and every gram of nutrient is
  irreplaceable cargo brought from Earth. The closed-loop recycling
  efficiency of this system is one of the core judging criteria.
  This file models exactly that loop — and the RL agent learns to
  optimise it over 450 sols.

Data sources:
  02_Controlled_Environment_Agriculture_Principles.md  → water/nutrient targets
  05_Human_Nutritional_Strategy.md                     → crew water consumption
  06_Greenhouse_Operational_Scenarios.md               → failure modes

Call order in main.py each sol:
  1. martian.simulate_sol()    → GreenhouseState (climate)
  2. crops.simulate_crops()    → SimulationResult (consumption figures)
  3. resources.update()        → GreenhouseState (resource levels corrected)
  4. planner.plan()            → DailySchedule
  5. reward.score()            → RewardSignal
"""

from __future__ import annotations
import logging
from dataclasses import dataclass

from agent.models import GreenhouseState

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# MISSION CONSTANTS
# Fixed quantities loaded onto the spacecraft — cannot be resupplied
# ─────────────────────────────────────────────────────────────────────────────

# Water: subsurface ice extraction supplements cargo, but extraction
# equipment has limited throughput (~20L/day from ice melting)
ICE_EXTRACTION_LITERS_PER_SOL = 20.0

# Crew water consumption (doc 05: 8-10L/day total for 4 crew)
CREW_WATER_LITERS_PER_SOL = 9.0

# Nutrient stocks loaded at mission start (kg, converted to ppm usage budget)
# These replenish the solution but are finite — rationed over 450 sols
NUTRIENT_N_STOCK_PPM_BUDGET  = 150.0 * 450   # total N available for mission
NUTRIENT_K_STOCK_PPM_BUDGET  = 200.0 * 450
NUTRIENT_FE_STOCK_PPM_BUDGET = 2.0   * 450

# Daily replenishment limits (how much nutrient we can dose per sol)
MAX_N_DOSE_PER_SOL  = 50.0    # ppm — increased to keep up with peak crop consumption
MAX_K_DOSE_PER_SOL  = 65.0    # ppm — increased to keep up with peak crop consumption
MAX_FE_DOSE_PER_SOL = 0.25    # ppm — visible drift but won't hit critical over 450 sols

# Critical reserve thresholds — below these, planner must conserve
WATER_CRITICAL_LITERS   = 100.0
NUTRIENT_N_CRITICAL_PPM = 50.0
NUTRIENT_K_CRITICAL_PPM = 80.0
NUTRIENT_FE_CRITICAL_PPM = 0.3

# pH correction limits per sol
MAX_PH_CORRECTION_PER_SOL = 0.3   # pH units — gradual adjustment only

# Target ranges (doc 02)
TARGET_PH_LOW  = 5.5
TARGET_PH_HIGH = 6.5
TARGET_EC_LOW  = 1.5
TARGET_EC_HIGH = 3.0


# ─────────────────────────────────────────────────────────────────────────────
# RESOURCE STATUS — what the system reports back
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ResourceStatus:
    """
    Summary of resource levels and flags after today's update.
    Consumed by reward.py (efficiency scoring) and schemas.py (frontend).
    """
    day: int

    # Water
    water_available_liters: float
    water_consumed_liters: float
    water_recycled_liters: float
    water_extracted_liters: float
    water_critical: bool

    # Nutrients
    nutrient_n_ppm: float
    nutrient_k_ppm: float
    nutrient_fe_ppm: float
    n_dosed_ppm: float
    k_dosed_ppm: float
    fe_dosed_ppm: float
    nutrients_critical: bool

    # Solution quality
    ph: float
    ec_ms_cm: float
    ph_corrected: bool
    ec_corrected: bool

    # Reserves remaining (fraction of mission total)
    n_stock_remaining_pct: float
    k_stock_remaining_pct: float
    fe_stock_remaining_pct: float

    # Flags for reward.py
    any_critical: bool


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — WATER DEDUCTION
# What left the system today?
# ─────────────────────────────────────────────────────────────────────────────

def _deduct_water(
    current_liters: float,
    crop_consumption_liters: float,
) -> tuple[float, float]:
    """
    Deduct crop water consumption and crew drinking water from reserves.
    Crew consumption is non-negotiable — always deducted first.

    Returns: (remaining_liters, total_consumed)
    """
    total_consumed = crop_consumption_liters + CREW_WATER_LITERS_PER_SOL
    remaining      = max(current_liters - total_consumed, 0.0)

    if remaining == 0.0:
        logger.error(
            "CRITICAL: Water reserves depleted. Consumed %.1fL, had %.1fL.",
            total_consumed, current_liters,
        )

    return round(remaining, 1), round(total_consumed, 1)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — CLOSED-LOOP WATER RECYCLING
# This is the core innovation — recapturing water that would otherwise be lost
# ─────────────────────────────────────────────────────────────────────────────

def _recycle_water(
    water_after_deduction: float,
    crop_consumption_liters: float,
    humidity_rh: float,
    recycling_efficiency: float = 0.85,
) -> tuple[float, float]:
    """
    Model the closed-loop water recycling system.

    Three recovery streams:
      1. Plant transpiration recovery — plants release water vapour
         which the dehumidifier captures and returns to the reservoir.
         Recovery rate: ~60-70% of water plants consumed.

      2. Crew greywater recovery — urine processing, shower water.
         Recovery rate: ~80% of crew water consumption (NASA standard).

      3. Condensate from greenhouse atmosphere.
         Based on current humidity — higher humidity = more to capture.

    recycling_efficiency models system degradation over time.
    Default 0.85 = 85% efficient (degrades with the water_recycling_decline
    failure event from martian.py reducing this to ~0.72).

    Why this matters: on Mars, 85% recycling efficiency means the system
    only needs ~15% make-up water from ice extraction per cycle.
    This is what makes a 450-sol mission feasible.

    Returns: (water_after_recycling, total_recycled)
    """
    # Stream 1: transpiration recovery
    # Plants release water vapour proportional to what they consumed.
    # Rate improves as the greenhouse matures — more active plants = more vapour.
    # Base rate 0.65 is well established for hydroponic systems.
    transpiration_recovery = crop_consumption_liters * 0.65 * recycling_efficiency

    # Stream 2: crew greywater
    # NASA standard: ~80% of crew water use is recoverable (urine + shower + breath)
    crew_recovery = CREW_WATER_LITERS_PER_SOL * 0.80 * recycling_efficiency

    # Stream 3: atmospheric condensate
    # Previous threshold was 60% — humidity never exceeded this so condensate was always 0.
    # Fix: lower threshold to 40% so condensate always contributes at normal greenhouse humidity.
    # At 60% RH (our target): (60-40)/60 * 8 * 0.85 = ~2.3L/sol base contribution.
    # At 70% RH (peak transpiration): (70-40)/60 * 8 * 0.85 = ~3.4L/sol.
    # This makes the ratio dynamic — it improves as more plants transpire and raise humidity.
    condensate = max((humidity_rh - 40.0) / 60.0, 0.0) * 8.0 * recycling_efficiency

    # Stream 4: base envelope condensate
    # Even at low humidity, greenhouse polycarbonate panels collect some condensate.
    # This is a fixed ~1.5L/sol minimum regardless of crop status or humidity.
    # Represents dew formation on cooler panel surfaces overnight.
    base_condensate = 1.5 * recycling_efficiency

    total_recycled = transpiration_recovery + crew_recovery + condensate + base_condensate
    water_after    = water_after_deduction + total_recycled

    logger.info(
        "Water recycling | transpiration=%.1fL crew=%.1fL condensate=%.1fL base=%.1fL → +%.1fL",
        transpiration_recovery, crew_recovery, condensate, base_condensate, total_recycled,
    )

    return round(water_after, 1), round(total_recycled, 1)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — ICE EXTRACTION SUPPLEMENT
# Subsurface ice melting tops up what recycling can't cover
# ─────────────────────────────────────────────────────────────────────────────

def _extract_ice(
    water_after_recycling: float,
    extraction_rate: float = ICE_EXTRACTION_LITERS_PER_SOL,
) -> tuple[float, float]:
    """
    Add water from subsurface ice extraction.
    Limited to ICE_EXTRACTION_LITERS_PER_SOL — the extraction
    equipment has fixed throughput.

    This is the only net-new water entering the system each sol.
    Everything else is recycled. The RL agent learns to keep
    consumption low enough that recycling + extraction stays positive.

    Returns: (water_with_extraction, extracted_liters)
    """
    new_total = water_after_recycling + extraction_rate
    logger.info("Ice extraction: +%.1fL", extraction_rate)
    return round(new_total, 1), round(extraction_rate, 1)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — NUTRIENT MANAGEMENT
# Deduct what crops consumed, replenish from stored stock
# ─────────────────────────────────────────────────────────────────────────────

def _update_nutrients(
    current_n: float,
    current_k: float,
    current_fe: float,
    n_consumed: float,
    k_consumed: float,
    day: int,
    n_stock_used: float,
    k_stock_used: float,
    fe_stock_used: float,
) -> tuple[float, float, float, float, float, float, float, float, float]:
    """
    Deduct consumption, then replenish from mission stock up to daily dose limit.

    Replenishment logic:
      - If nutrient level drops below target → dose up to MAX_X_DOSE_PER_SOL
      - If stock is running low (<20% remaining) → ration doses to 50%
      - Never dose above the target starting level (don't overfeed)

    Returns:
      new_n, new_k, new_fe,
      n_dosed, k_dosed, fe_dosed,
      updated n_stock_used, k_stock_used, fe_stock_used
    """

    # ── Deduct consumption ────────────────────────────────────────────────────
    after_n  = max(current_n  - n_consumed,  0.0)
    after_k  = max(current_k  - k_consumed,  0.0)
    after_fe = max(current_fe - 0.15,        0.0)   # Fe consumed at ~0.15 ppm/sol

    # ── Check stock levels — ration if running low ────────────────────────────
    n_stock_remaining  = NUTRIENT_N_STOCK_PPM_BUDGET  - n_stock_used
    k_stock_remaining  = NUTRIENT_K_STOCK_PPM_BUDGET  - k_stock_used
    fe_stock_remaining = NUTRIENT_FE_STOCK_PPM_BUDGET - fe_stock_used

    n_ration  = 0.5 if n_stock_remaining  < NUTRIENT_N_STOCK_PPM_BUDGET  * 0.20 else 1.0
    k_ration  = 0.5 if k_stock_remaining  < NUTRIENT_K_STOCK_PPM_BUDGET  * 0.20 else 1.0
    fe_ration = 0.5 if fe_stock_remaining < NUTRIENT_FE_STOCK_PPM_BUDGET * 0.20 else 1.0

    if n_ration < 1.0:
        logger.warning("Day %d: N stock at <20%% — rationing doses.", day)
    if k_ration < 1.0:
        logger.warning("Day %d: K stock at <20%% — rationing doses.", day)

    # ── Dose nutrients back up toward targets ─────────────────────────────────
    # Emergency boost: if levels drop below warning threshold, dose at full
    # capacity regardless of how far below target we are. This prevents the
    # system getting stuck in a low-nutrient spiral over a long mission.
    N_WARNING  = 100.0   # ppm — below this, dose at maximum rate
    K_WARNING  = 140.0   # ppm
    FE_WARNING = 1.0     # ppm

    n_needed  = MAX_N_DOSE_PER_SOL  if after_n  < N_WARNING  else max(150.0 - after_n,  0.0)
    k_needed  = MAX_K_DOSE_PER_SOL  if after_k  < K_WARNING  else max(200.0 - after_k,  0.0)
    fe_needed = max(2.0   - after_fe, 0.0)

    n_dosed  = min(n_needed,  MAX_N_DOSE_PER_SOL  * n_ration)
    k_dosed  = min(k_needed,  MAX_K_DOSE_PER_SOL  * k_ration)
    fe_dosed = min(fe_needed, MAX_FE_DOSE_PER_SOL * fe_ration)

    # ── Clamp to available stock ──────────────────────────────────────────────
    n_dosed  = min(n_dosed,  n_stock_remaining)
    k_dosed  = min(k_dosed,  k_stock_remaining)
    fe_dosed = min(fe_dosed, fe_stock_remaining)

    new_n  = round(after_n  + n_dosed,  1)
    new_k  = round(after_k  + k_dosed,  1)
    new_fe = round(after_fe + fe_dosed, 3)

    logger.info(
        "Nutrients | N: %.1f→%.1f (+%.1f dosed) | K: %.1f→%.1f (+%.1f) | Fe: %.3f→%.3f",
        after_n, new_n, n_dosed,
        after_k, new_k, k_dosed,
        after_fe, new_fe,
    )

    return (
        new_n, new_k, new_fe,
        round(n_dosed, 2), round(k_dosed, 2), round(fe_dosed, 3),
        n_stock_used + n_dosed,
        k_stock_used + k_dosed,
        fe_stock_used + fe_dosed,
    )


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — SOLUTION QUALITY (pH and EC)
# ─────────────────────────────────────────────────────────────────────────────

def _correct_ph(current_ph: float) -> tuple[float, bool]:
    """
    Gradually nudge pH toward the 5.5-6.5 target range.
    pH drifts naturally — plants consume H+ and OH- ions asymmetrically.
    pH adjusters (pH Up / pH Down solutions) are rationed to
    MAX_PH_CORRECTION_PER_SOL to avoid shocking the root zone.

    Returns: (new_ph, was_corrected)
    """
    if TARGET_PH_LOW <= current_ph <= TARGET_PH_HIGH:
        return round(current_ph, 2), False

    target    = (TARGET_PH_LOW + TARGET_PH_HIGH) / 2   # aim for 6.0
    error     = target - current_ph
    correction = _clamp(error, -MAX_PH_CORRECTION_PER_SOL, MAX_PH_CORRECTION_PER_SOL)
    new_ph    = round(current_ph + correction, 2)

    logger.info("pH correction: %.2f → %.2f", current_ph, new_ph)
    return new_ph, True


def _update_ec(
    current_ec: float,
    n_dosed: float,
    k_dosed: float,
    water_recycled: float,
) -> tuple[float, bool]:
    """
    Update electrical conductivity (EC) of the nutrient solution.

    EC rises when:
      - Nutrients are added (dosing)
      - Water evaporates (concentrates the solution)

    EC falls when:
      - Plants uptake nutrients
      - Fresh recycled water dilutes the solution

    Target: 1.5-3.0 mS/cm (doc 02)
    If EC goes above 4.0 → salinity stress (crops.py will detect this)

    Returns: (new_ec, was_corrected)
    """
    # Nutrient dosing raises EC — approx 0.1 mS/cm per 10 ppm nutrients added
    dose_effect   = (n_dosed + k_dosed) * 0.005

    # Recycled water slightly dilutes EC (pure water coming back in)
    dilution      = min(water_recycled * 0.002, 0.1)

    # Natural drift — slight concentration from evaporation
    evap_drift    = 0.05

    new_ec = current_ec + dose_effect - dilution + evap_drift

    # If EC too high, flag for dilution (crops.py will catch the salinity stress)
    corrected = False
    if new_ec > TARGET_EC_HIGH:
        # Emergency dilution — add a burst of fresh water to solution
        new_ec    = new_ec * 0.92   # 8% dilution
        corrected = True
        logger.warning("EC too high (%.2f) — emergency dilution applied.", new_ec)

    new_ec = round(_clamp(new_ec, 0.5, 6.0), 2)
    return new_ec, corrected


# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — CRITICAL RESERVE CHECK
# Flag anything that reward.py needs to penalise hard
# ─────────────────────────────────────────────────────────────────────────────

def _check_critical_levels(
    water: float,
    n: float,
    k: float,
    fe: float,
) -> tuple[bool, bool]:
    """
    Returns: (water_critical, nutrients_critical)
    These flags flow into ResourceStatus → reward.py → heavy penalty.
    Critical = below the threshold where crew/crops are at risk.
    """
    water_critical    = water < WATER_CRITICAL_LITERS
    nutrients_critical = (
        n  < NUTRIENT_N_CRITICAL_PPM  or
        k  < NUTRIENT_K_CRITICAL_PPM  or
        fe < NUTRIENT_FE_CRITICAL_PPM
    )

    if water_critical:
        logger.error("CRITICAL: Water at %.1fL (threshold: %.1fL)", water, WATER_CRITICAL_LITERS)
    if nutrients_critical:
        logger.error("CRITICAL: Nutrient levels below safe threshold. N=%.1f K=%.1f Fe=%.3f", n, k, fe)

    return water_critical, nutrients_critical


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def update(
    state: GreenhouseState,
    water_consumed_liters: float,
    nutrient_n_consumed_ppm: float,
    nutrient_k_consumed_ppm: float,
    n_stock_used: float = 0.0,
    k_stock_used: float = 0.0,
    fe_stock_used: float = 0.0,
    recycling_efficiency: float = 0.85,
) -> tuple[GreenhouseState, ResourceStatus]:
    """
    Main entry point. Called by main.py after crops.simulate_crops().

    Takes:
      state                   : current GreenhouseState (post-martian, post-crops)
      water_consumed_liters   : from SimulationResult.water_consumed_liters
      nutrient_n_consumed_ppm : from SimulationResult.nutrient_n_consumed_ppm
      nutrient_k_consumed_ppm : from SimulationResult.nutrient_k_consumed_ppm
      n/k/fe_stock_used       : running totals maintained by main.py
      recycling_efficiency    : degraded by water_recycling_decline failure event

    Returns:
      updated GreenhouseState  — with corrected water/nutrient/pH/EC levels
      ResourceStatus           — summary for reward.py and frontend

    This function runs the 6 steps in sequence:
      1. Deduct consumption
      2. Recycle water
      3. Extract ice
      4. Update nutrients
      5. Correct pH and EC
      6. Check critical levels
    """
    logger.info("--- Sol %d resource update ---", state.day)

    # ── Step 1: Deduct water consumption ─────────────────────────────────────
    water_after_deduct, total_consumed = _deduct_water(
        state.water_liters_available,
        water_consumed_liters,
    )

    # ── Step 2: Closed-loop recycling ────────────────────────────────────────
    water_after_recycle, recycled = _recycle_water(
        water_after_deduct,
        water_consumed_liters,
        state.humidity_rh,
        recycling_efficiency,
    )

    # ── Step 3: Ice extraction ────────────────────────────────────────────────
    water_final, extracted = _extract_ice(water_after_recycle)

    # ── Step 4: Nutrients ─────────────────────────────────────────────────────
    (new_n, new_k, new_fe,
     n_dosed, k_dosed, fe_dosed,
     new_n_stock, new_k_stock, new_fe_stock) = _update_nutrients(
        state.nutrient_n_ppm,
        state.nutrient_k_ppm,
        state.nutrient_fe_ppm,
        nutrient_n_consumed_ppm,
        nutrient_k_consumed_ppm,
        state.day,
        n_stock_used,
        k_stock_used,
        fe_stock_used,
    )

    # ── Step 5: pH and EC correction ─────────────────────────────────────────
    new_ph, ph_corrected = _correct_ph(state.ph)
    new_ec, ec_corrected = _update_ec(state.ec_ms_cm, n_dosed, k_dosed, recycled)

    # ── Step 6: Critical level check ─────────────────────────────────────────
    water_critical, nutrients_critical = _check_critical_levels(
        water_final, new_n, new_k, new_fe,
    )

    # ── Build updated GreenhouseState ─────────────────────────────────────────
    # Only resource-related fields change here.
    # Climate fields (temp, CO2, PAR etc.) stay as martian.py set them.
    updated_state = GreenhouseState(
        day                    = state.day,
        temp_celsius           = state.temp_celsius,
        humidity_rh            = state.humidity_rh,
        co2_ppm                = state.co2_ppm,
        par_umol_m2s           = state.par_umol_m2s,
        ph                     = new_ph,
        ec_ms_cm               = new_ec,
        water_liters_available = water_final,
        nutrient_n_ppm         = new_n,
        nutrient_k_ppm         = new_k,
        nutrient_fe_ppm        = new_fe,
        power_kwh_available    = state.power_kwh_available,
        growth_system          = state.growth_system,
        total_area_m2          = state.total_area_m2,
    )

    # ── Build ResourceStatus for reward.py and frontend ───────────────────────
    n_stock_remaining_pct  = 1.0 - (new_n_stock  / NUTRIENT_N_STOCK_PPM_BUDGET)
    k_stock_remaining_pct  = 1.0 - (new_k_stock  / NUTRIENT_K_STOCK_PPM_BUDGET)
    fe_stock_remaining_pct = 1.0 - (new_fe_stock / NUTRIENT_FE_STOCK_PPM_BUDGET)

    status = ResourceStatus(
        day                     = state.day,
        water_available_liters  = water_final,
        water_consumed_liters   = total_consumed,
        water_recycled_liters   = recycled,
        water_extracted_liters  = extracted,
        water_critical          = water_critical,
        nutrient_n_ppm          = new_n,
        nutrient_k_ppm          = new_k,
        nutrient_fe_ppm         = new_fe,
        n_dosed_ppm             = n_dosed,
        k_dosed_ppm             = k_dosed,
        fe_dosed_ppm            = fe_dosed,
        nutrients_critical      = nutrients_critical,
        ph                      = new_ph,
        ec_ms_cm                = new_ec,
        ph_corrected            = ph_corrected,
        ec_corrected            = ec_corrected,
        n_stock_remaining_pct   = round(n_stock_remaining_pct,  3),
        k_stock_remaining_pct   = round(k_stock_remaining_pct,  3),
        fe_stock_remaining_pct  = round(fe_stock_remaining_pct, 3),
        any_critical            = water_critical or nutrients_critical,
    )

    logger.info(
        "Sol %d resources | water=%.1fL (recycled=%.1f extracted=%.1f) "
        "| N=%.1f K=%.1f Fe=%.3f | pH=%.2f EC=%.2f | critical=%s",
        state.day,
        water_final, recycled, extracted,
        new_n, new_k, new_fe,
        new_ph, new_ec,
        status.any_critical,
    )

    return updated_state, status


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def initial_stock_tracker() -> dict[str, float]:
    """
    Returns a fresh stock tracker for main.py to maintain across sols.
    Tracks cumulative usage of finite nutrient stores.
    """
    return {
        "n_stock_used":          0.0,
        "k_stock_used":          0.0,
        "fe_stock_used":         0.0,
        "recycling_efficiency":  0.85,   # degrades if failure events occur
    }