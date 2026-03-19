"""
server/environment/martian.py

Atmospheric simulation for the Mars greenhouse.
Runs once per simulated sol (Martian day).

Responsibility:
  - Model how Mars conditions (temperature swings, radiation, low pressure)
    naturally stress the greenhouse systems each day
  - Model the greenhouse control systems fighting back (heaters, LEDs, CO2)
  - Return an updated GreenhouseState that planner.py and crops.py consume

Physics sources: 01_Mars_Environment_Extended.md
Control targets: 02_Controlled_Environment_Agriculture_Principles.md

Called by:  main.py (before planner.py each day)
Feeds into: planner.py (reads GreenhouseState)
            crops.py   (reads GreenhouseState to compute plant stress)
"""

from __future__ import annotations
import logging
import math
import random

from agent.models import GreenhouseState, MarsEnvironment

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# GREENHOUSE CONTROL TARGETS  (from doc 02)
# These are what the HVAC / lighting / CO2 systems are trying to hit.
# ─────────────────────────────────────────────────────────────────────────────

TARGET_TEMP_C       = 20.0    # midpoint of 15-22°C leafy crop range
TARGET_HUMIDITY_RH  = 60.0    # midpoint of 50-70% RH
TARGET_CO2_PPM      = 1000.0  # midpoint of 800-1200 ppm optimal
TARGET_PAR          = 200.0   # µmol/m²/s — midpoint for leafy crops
TARGET_PH           = 6.0     # midpoint of 5.5-6.5

# How hard the control systems can push per day (max correction)
MAX_TEMP_CORRECTION_C    = 5.0    # heater/cooler capacity per sol
MAX_HUMIDITY_CORRECTION  = 10.0   # humidifier/dehumidifier per sol
MAX_CO2_CORRECTION_PPM   = 150.0  # CO2 injector / ventilation per sol
MAX_PAR_CORRECTION       = 50.0   # LED dimming/brightening per sol

# Human safety hard limits (from doc 04 — priority 1)
CO2_SAFETY_MAX_PPM  = 1500.0
TEMP_SAFETY_MIN_C   = 10.0
TEMP_SAFETY_MAX_C   = 35.0


# ─────────────────────────────────────────────────────────────────────────────
# MARS ENVIRONMENTAL STRESS
# How much Mars degrades the greenhouse each day before systems compensate
# ─────────────────────────────────────────────────────────────────────────────

def _mars_temp_pressure(day: int, mars_env: MarsEnvironment) -> float:
    """
    Mars surface temperature follows a sinusoidal daily cycle.
    We model the heat bleed-through into the greenhouse envelope.

    On Mars the swing is roughly -140°C to +21°C surface.
    The greenhouse insulation reduces the bleed to a manageable drift,
    but without active heating the interior would drift toward -10°C overnight.

    Returns: raw (pre-correction) interior temp drift for this sol.
    """
    # Sinusoidal day/night cycle — period 24.6h, normalised to 1 sol
    sol_angle     = (2 * math.pi * day) / 365   # seasonal variation
    diurnal_angle = (2 * math.pi * (day % 1))   # intra-day (simplified to sol)

    # Seasonal component: Mars has an eccentric orbit — summer/winter swings
    seasonal_offset = 2.0 * math.sin(sol_angle)   # ±2°C seasonal drift (well-insulated greenhouse)

    # Diurnal bleed-through after insulation — greenhouse loses ~3°C overnight
    diurnal_bleed = -3.0 * math.cos(diurnal_angle)

    # Random noise: dust storms, pressure fluctuations
    noise = random.gauss(0, 0.5)

    return seasonal_offset + diurnal_bleed + noise


def _mars_solar_par(day: int, mars_env: MarsEnvironment) -> float:
    """
    Available solar PAR on Mars: ~590 W/m² total irradiance, ~43% of Earth.
    PAR (400-700nm) is ~45% of total solar — so ~265 W/m² or ~530 µmol/m²/s.

    But Mars has dust storms that can reduce this to near zero.
    We model a gradual dust opacity that varies seasonally.

    Returns: natural PAR available today (µmol/m²/s), pre-LED supplement.
    """
    # Dust storm season: roughly days 180-250 (southern summer on Mars)
    if 180 <= (day % 365) <= 250:
        dust_opacity = random.uniform(0.1, 0.5)   # heavy dust
    else:
        dust_opacity = random.uniform(0.7, 1.0)   # normal transmission

    GLAZING_FACTOR = 0.55
    base_par = 530.0 * dust_opacity * GLAZING_FACTOR
    return round(base_par, 1)


def _mars_co2_leak(state: GreenhouseState) -> float:
    """
    The sealed greenhouse slowly leaks — CO2 from the Martian atmosphere
    can seep in through seals (adds CO2) and the plants consume CO2
    during photosynthesis (removes CO2).

    Net effect modelled as a small random drift around the current value.
    In dust storm scenarios, we assume operators seal the greenhouse tighter
    so leakage is reduced.

    Returns: CO2 delta (ppm) from natural causes this sol.
    """
    # Plants consume ~50-100 ppm/day during active photosynthesis
    # Martian CO2 seep adds ~10-30 ppm/day through seal imperfections
    plant_consumption = -random.uniform(50, 100)
    seal_seep         = random.uniform(10, 30)
    return plant_consumption + seal_seep


def _mars_humidity_drift(state: GreenhouseState) -> float:
    """
    Mars is extremely dry (near 0% RH outside).
    The greenhouse loses humidity through:
    - Crew respiration adds ~0.5L water vapour/person/day
    - Plant transpiration adds significant moisture
    - Seal imperfections bleed dry Mars air in

    Net: humidity tends to drift down ~2-5% RH per day without active control.
    """
    transpiration_gain = random.uniform(2.0, 5.0)    # plants add moisture
    seal_loss          = -random.uniform(3.0, 7.0)   # Mars air bleeds in
    crew_gain          = 0.5 * 4                      # 4 crew members
    return transpiration_gain + seal_loss + crew_gain


# ─────────────────────────────────────────────────────────────────────────────
# CONTROL SYSTEMS
# Greenhouse systems correcting toward targets — but power-limited
# ─────────────────────────────────────────────────────────────────────────────

def _apply_temp_control(current: float, drift: float, power_available: float) -> tuple[float, float]:
    """
    HVAC system: push temperature toward TARGET_TEMP_C.
    Power-limited: if power_available is low, correction is reduced.

    Uses a proportional controller — corrects 70% of error per sol,
    not 100%. This leaves a natural residual of ±0.5-1.5°C that makes
    the environment feel real rather than perfectly locked at 20.0°C.

    Returns: (new_temp, power_consumed_kwh)
    """
    CONTROL_EFFICIENCY = 0.85  # HVAC corrects 85% of error per sol
    raw           = current + drift
    error         = TARGET_TEMP_C - raw

    # Emergency recovery: if temperature is near crop minimum (15°C) or
    # safety floor (10°C), HVAC runs at full power regardless of efficiency.
    # This prevents permanent pinning at safety floor after cold events.
    if raw < 15.0:
        effective_efficiency = 1.0   # full power when crops are at risk
    else:
        effective_efficiency = CONTROL_EFFICIENCY

    power_factor  = min(power_available / 10.0, 1.0)
    correction    = _clamp(error, -MAX_TEMP_CORRECTION_C, MAX_TEMP_CORRECTION_C) * power_factor * effective_efficiency
    power_used    = abs(correction) * 0.8
    # Add small sensor noise — real thermometers have ±0.1°C imprecision
    # Only add noise when not in emergency recovery mode
    sensor_noise  = random.gauss(0, 0.1) if raw >= 15.0 else 0.0
    return round(raw + correction + sensor_noise, 2), round(power_used, 2)


def _apply_humidity_control(current: float, drift: float) -> float:
    """
    Humidifier/dehumidifier: push toward TARGET_HUMIDITY_RH.
    Humidity control is low power — not modelled as power-limited.

    Uses same 85% proportional control as temp/CO2 — leaves natural
    residual variation of ±1-2% RH rather than locking at exactly 60%.
    """
    CONTROL_EFFICIENCY = 0.85
    raw        = current + drift
    error      = TARGET_HUMIDITY_RH - raw
    correction = _clamp(error, -MAX_HUMIDITY_CORRECTION, MAX_HUMIDITY_CORRECTION) * CONTROL_EFFICIENCY
    # Small sensor noise — real humidity sensors have ±0.5% RH imprecision
    sensor_noise = random.gauss(0, 0.5)
    return round(_clamp(raw + correction + sensor_noise, 0.0, 100.0), 1)


def _apply_co2_control(current: float, drift: float, power_available: float) -> tuple[float, float]:
    """
    CO2 injector + ventilation: push toward TARGET_CO2_PPM.
    If CO2 > SAFETY_MAX (1500 ppm) → emergency ventilation regardless of power.

    Returns: (new_co2_ppm, power_consumed_kwh)
    """
    raw = current + drift

    # Safety override — always ventilate if above human safety limit
    if raw > CO2_SAFETY_MAX_PPM:
        logger.warning("CO2 SAFETY OVERRIDE: %.0f ppm > %.0f ppm. Emergency ventilation.", raw, CO2_SAFETY_MAX_PPM)
        raw = CO2_SAFETY_MAX_PPM - 100   # forced reduction

    CONTROL_EFFICIENCY = 0.70  # CO2 system corrects 70% of error per sol
    error        = TARGET_CO2_PPM - raw
    power_factor = min(power_available / 5.0, 1.0)
    # Proportional correction — leaves natural residual of ±15-40ppm
    correction   = _clamp(error, -MAX_CO2_CORRECTION_PPM, MAX_CO2_CORRECTION_PPM) * power_factor * CONTROL_EFFICIENCY
    power_used   = abs(correction) * 0.02
    # Small sensor noise — real CO2 sensors have ±5ppm imprecision
    sensor_noise = random.gauss(0, 5.0)
    return round(_clamp(raw + correction + sensor_noise, 0.0, 2000.0), 1), round(power_used, 2)


def _apply_led_control(natural_par: float, power_available: float) -> tuple[float, float]:
    """
    LED supplement: top up natural PAR to TARGET_PAR.
    LEDs are the biggest power consumer in the greenhouse.

    Returns: (total_par, power_consumed_kwh)
    """
    shortfall     = max(TARGET_PAR - natural_par, 0.0)
    power_factor  = min(power_available / 20.0, 1.0)   # LEDs need ~20 kWh at full
    supplement    = min(shortfall, MAX_PAR_CORRECTION) * power_factor
    power_used    = supplement * 0.05                   # ~0.05 kWh per µmol/m²/s
    total_par     = round(natural_par + supplement, 1)
    return total_par, round(power_used, 2)


# ─────────────────────────────────────────────────────────────────────────────
# FAILURE SCENARIOS  (from doc 06 — Greenhouse Operational Scenarios)
# Random low-probability events that the RL agent must learn to handle
# ─────────────────────────────────────────────────────────────────────────────

def _check_failure_events(state: GreenhouseState, day: int) -> dict[str, bool]:
    """
    Randomly trigger failure scenarios from doc 06.
    Probability is low per day but increases if the mission is long.

    Returns dict of active failures this sol.
    """
    # Base probabilities per sol
    failures = {
        "led_malfunction":          random.random() < 0.005,   # 0.5%/day
        "temp_control_failure":     random.random() < 0.003,   # 0.3%/day
        "co2_imbalance":            random.random() < 0.004,   # 0.4%/day
        "nutrient_contamination":   random.random() < 0.002,   # 0.2%/day
        "water_recycling_decline":  random.random() < 0.008,   # 0.8%/day
    }

    active = {k: v for k, v in failures.items() if v}
    if active:
        logger.warning("Day %d: failure events triggered: %s", day, list(active.keys()))
    return active


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def simulate_sol(
    state: GreenhouseState,
    mars_env: MarsEnvironment,
) -> GreenhouseState:
    """
    Run one sol of atmospheric simulation.
    Takes yesterday's GreenhouseState, returns today's.

    Called by main.py BEFORE planner.py so the planner always
    sees the current environment, not yesterday's.

    Steps:
      1. Compute Mars-driven drifts (what nature does to the greenhouse)
      2. Check for failure events (doc 06 scenarios)
      3. Apply control systems within power budget (what tech fights back)
      4. Update and return new GreenhouseState
    """
    day = state.day + 1
    logger.info("--- Sol %d atmospheric simulation ---", day)

    # ── Step 1: Mars-driven drifts ───────────────────────────────────────────
    temp_drift     = _mars_temp_pressure(day, mars_env)
    natural_par    = _mars_solar_par(day, mars_env)
    co2_drift      = _mars_co2_leak(state)
    humidity_drift = _mars_humidity_drift(state)

    # ── Step 2: Failure events ────────────────────────────────────────────────
    failures = _check_failure_events(state, day)

    # Failures degrade the corresponding control systems
    if failures.get("led_malfunction"):
        natural_par *= 0.2          # LEDs offline — only 20% natural light
    if failures.get("temp_control_failure"):
        temp_drift  *= 3.0          # HVAC impaired — Mars cold bleeds in harder
    if failures.get("co2_imbalance"):
        co2_drift   += random.uniform(100, 300)   # CO2 spike

    # ── Step 3: Control systems (within power budget) ────────────────────────
    power_remaining = state.power_kwh_available
    power_used_total = 0.0

    # Temperature (highest priority after safety)
    new_temp, pwr = _apply_temp_control(state.temp_celsius, temp_drift, power_remaining)
    new_temp       = _clamp(new_temp, TEMP_SAFETY_MIN_C, TEMP_SAFETY_MAX_C)
    power_remaining -= pwr
    power_used_total += pwr

    # CO2 (human safety — always gets power)
    new_co2, pwr = _apply_co2_control(state.co2_ppm, co2_drift, power_remaining)
    power_remaining  -= pwr
    power_used_total += pwr

    # LEDs
    new_par, pwr = _apply_led_control(natural_par, power_remaining)
    power_remaining  -= pwr
    power_used_total += pwr

    # Humidity (low power cost)
    new_humidity = _apply_humidity_control(state.humidity_rh, humidity_drift)

    # Water recycling failure reduces available water
    water_available = state.water_liters_available
    if failures.get("water_recycling_decline"):
        water_available *= 0.85    # 15% loss in recycling efficiency
        logger.warning("Day %d: water recycling degraded — available water reduced.", day)

    # Nutrient contamination spikes EC (doc 04: salinity stress)
    new_ec = state.ec_ms_cm
    if failures.get("nutrient_contamination"):
        new_ec += random.uniform(0.5, 1.5)
        logger.warning("Day %d: nutrient contamination — EC spike to %.2f.", day, new_ec)

    # Power regenerates partially each sol (solar panels + stored)
    # Mars solar: 590 W/m² × ~20m² panel area × 6h effective sun / 1000 = ~70 kWh/day theoretical
    # Accounting for efficiency and dust: ~40-50 kWh realistically
    power_generated = random.uniform(35.0, 50.0)
    if 180 <= (day % 365) <= 250:
        power_generated *= 0.4    # dust storm season — severe reduction

    # Cap at battery storage limit — realistic for a Mars greenhouse
    BATTERY_MAX_KWH = 300.0
    new_power = min(max(power_remaining + power_generated, 0.0), BATTERY_MAX_KWH)

    # ── Step 4: Build and return new state ───────────────────────────────────
    new_state = GreenhouseState(
        day                    = day,
        temp_celsius           = new_temp,
        humidity_rh            = new_humidity,
        co2_ppm                = new_co2,
        par_umol_m2s           = new_par,
        ph                     = state.ph,            # pH managed by resources.py
        ec_ms_cm               = round(new_ec, 2),
        water_liters_available = round(water_available, 1),
        nutrient_n_ppm         = state.nutrient_n_ppm,  # managed by resources.py
        nutrient_k_ppm         = state.nutrient_k_ppm,
        nutrient_fe_ppm        = state.nutrient_fe_ppm,
        power_kwh_available    = round(new_power, 2),
        growth_system          = state.growth_system,
        total_area_m2          = state.total_area_m2,
    )

    logger.info(
        "Sol %d | Temp: %.1f°C | CO2: %.0fppm | PAR: %.0f | Humidity: %.1f%% | Power: %.1fkWh",
        day, new_temp, new_co2, new_par, new_humidity, new_power,
    )

    return new_state


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def initial_greenhouse_state(total_area_m2: float = 100.0) -> GreenhouseState:
    """
    Bootstrap a fresh GreenhouseState for day 0 of the mission.
    All values start at optimal setpoints — the simulation degrades from here.
    Called once by main.py at mission start.
    """
    return GreenhouseState(
        day                    = 0,
        temp_celsius           = TARGET_TEMP_C,
        humidity_rh            = TARGET_HUMIDITY_RH,
        co2_ppm                = TARGET_CO2_PPM,
        par_umol_m2s           = TARGET_PAR,
        ph                     = TARGET_PH,
        ec_ms_cm               = 2.0,
        water_liters_available = 500.0,
        nutrient_n_ppm         = 150.0,
        nutrient_k_ppm         = 200.0,
        nutrient_fe_ppm        = 2.0,
        power_kwh_available    = 50.0,
        total_area_m2          = total_area_m2,
    )