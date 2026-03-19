"""
server/environment/crops.py

Daily plant growth simulation and stress detection.
Runs once per simulated sol, AFTER martian.py has updated GreenhouseState.

Responsibility:
  - Compute how each active crop responded to today's environment
  - Detect abiotic stress conditions (7 categories from doc 04)
  - Project yield for each crop based on accumulated growth
  - Return a SimulationResult consumed by planner.py and reward.py

Data sources:
  03_Crop_Profiles_Extended.md       → growth tolerances, yield data
  04_Plant_Stress_and_Response_Guide → stress thresholds and actions

Call order in main.py each sol:
  1. martian.simulate_sol()    → produces GreenhouseState
  2. crops.simulate_crops()    → reads GreenhouseState, produces SimulationResult
  3. planner.plan()            → reads both, produces DailySchedule
  4. reward.score()            → reads SimulationResult + DailySchedule
"""

from __future__ import annotations
import logging
from dataclasses import dataclass, field

from agent.models import (
    CropProfile,
    CropType,
    GreenhouseState,
    PlantStressReport,
    StressType,
    default_crop_profiles,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# OUTPUT DATACLASSES
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class CropStatus:
    """
    The state of a single crop batch after today's simulation step.
    One per active crop per sol.
    """
    crop_type: CropType
    day_planted: int
    days_grown: int

    # Growth
    growth_rate_today: float       # 0.0 = no growth, 1.0 = optimal growth
    cumulative_growth: float       # accumulated growth_rate sum since planting
    projected_yield_kg_m2: float   # estimated harvest yield given growth so far

    # Stress
    stress_reports: list[PlantStressReport] = field(default_factory=list)
    is_stressed: bool = False

    # Readiness
    days_to_min_harvest: int = 0   # days until earliest possible harvest
    ready_to_harvest: bool = False


@dataclass
class SimulationResult:
    """
    Full output of one sol's crop simulation.
    This is the 'Simulation outcomes' node in the workflow diagram.
    Consumed by: planner.py (stress_respond), reward.py (scoring)
    """
    day: int
    crop_statuses: list[CropStatus]
    all_stress_reports: list[PlantStressReport]   # flattened across all crops

    # What was actually harvested and eaten today (zero on non-harvest days)
    daily_harvested_yield_kg: float
    daily_harvested_kcal: float
    daily_harvested_protein_g: float

    # Standing crop value — entire field projected value (for forecasting only)
    # Do NOT use this for nutrition scoring — it overcounts massively
    standing_crop_kcal: float
    standing_crop_protein_g: float
    total_projected_yield_kg: float  # kept for backwards compatibility

    # Resource consumption this sol
    water_consumed_liters: float
    nutrient_n_consumed_ppm: float
    nutrient_k_consumed_ppm: float


# ─────────────────────────────────────────────────────────────────────────────
# GROWTH RATE MODEL
# How well did the plant grow today given actual vs ideal conditions?
# ─────────────────────────────────────────────────────────────────────────────

def _compute_growth_rate(
    state: GreenhouseState,
    profile: CropProfile,
) -> float:
    """
    Computes a growth rate modifier in [0.0, 1.0] for today.

    Method: Liebig's Law of the Minimum — the most limiting factor
    determines growth. We compute a penalty for each environmental
    variable and take the minimum across all of them.

    This is agronomically accurate: a plant with perfect light but
    wrong temperature still grows poorly — the worst condition wins.

    Each factor scores 1.0 if inside the optimal range, and drops
    toward 0.0 as it moves outside tolerance bounds.
    """

    # ── Temperature factor ────────────────────────────────────────────────────
    temp_factor = _range_factor(
        value    = state.temp_celsius,
        opt_low  = profile.temp_min_celsius,
        opt_high = profile.temp_max_celsius,
        abs_low  = profile.temp_min_celsius - 5.0,   # 5°C below min = dead
        abs_high = profile.temp_stress_above + 8.0,  # 8°C above stress = dead
    )

    # ── Light (PAR) factor ────────────────────────────────────────────────────
    par_factor = _range_factor(
        value    = state.par_umol_m2s,
        opt_low  = profile.par_min_umol,
        opt_high = profile.par_max_umol,
        abs_low  = 50.0,                             # below 50 = effectively dark
        abs_high = profile.par_max_umol + 200.0,     # extreme light bleaching
    )

    # ── CO2 factor ────────────────────────────────────────────────────────────
    # Optimal: 800-1200 ppm (doc 02). Below 400 ppm = serious limitation.
    co2_factor = _range_factor(
        value    = state.co2_ppm,
        opt_low  = 800.0,
        opt_high = 1200.0,
        abs_low  = 300.0,
        abs_high = 1500.0,   # above safety limit — plants also suffer
    )

    # ── Humidity factor ───────────────────────────────────────────────────────
    humidity_factor = _range_factor(
        value    = state.humidity_rh,
        opt_low  = profile.humidity_min_rh,
        opt_high = profile.humidity_max_rh,
        abs_low  = 20.0,
        abs_high = 95.0,
    )

    # ── pH factor ────────────────────────────────────────────────────────────
    # Optimal: 5.5-6.5 for all crops (doc 02)
    ph_factor = _range_factor(
        value    = state.ph,
        opt_low  = 5.5,
        opt_high = 6.5,
        abs_low  = 4.5,
        abs_high = 8.0,
    )

    # ── EC (salinity) factor ──────────────────────────────────────────────────
    # Normal EC: 1.5-3.0 mS/cm. Above 4.0 = salinity stress.
    ec_factor = _range_factor(
        value    = state.ec_ms_cm,
        opt_low  = 1.5,
        opt_high = 3.0,
        abs_low  = 0.5,
        abs_high = 5.0,
    )

    # ── Liebig minimum — worst factor determines growth ───────────────────────
    growth_rate = min(temp_factor, par_factor, co2_factor,
                      humidity_factor, ph_factor, ec_factor)

    logger.debug(
        "%s growth factors | temp=%.2f par=%.2f co2=%.2f "
        "humidity=%.2f ph=%.2f ec=%.2f → rate=%.2f",
        profile.crop_type.value,
        temp_factor, par_factor, co2_factor,
        humidity_factor, ph_factor, ec_factor,
        growth_rate,
    )

    return round(growth_rate, 3)


def _range_factor(
    value: float,
    opt_low: float,
    opt_high: float,
    abs_low: float,
    abs_high: float,
) -> float:
    """
    Maps a sensor value to a growth factor in [0.0, 1.0].

    1.0  if value is inside [opt_low, opt_high]
    0.0  if value is at or beyond abs_low / abs_high
    Linear interpolation in between.

    Example for temperature with lettuce:
      opt_low=15, opt_high=22, abs_low=10, abs_high=33
      value=20 → 1.0
      value=25 → 0.58  (between opt_high and abs_high)
      value=33 → 0.0
    """
    if opt_low <= value <= opt_high:
        return 1.0
    elif value < opt_low:
        if value <= abs_low:
            return 0.0
        return (value - abs_low) / (opt_low - abs_low)
    else:  # value > opt_high
        if value >= abs_high:
            return 0.0
        return (abs_high - value) / (abs_high - opt_high)


# ─────────────────────────────────────────────────────────────────────────────
# STRESS DETECTION
# 7 abiotic stress categories from doc 04
# ─────────────────────────────────────────────────────────────────────────────

def _detect_stress(
    state: GreenhouseState,
    profile: CropProfile,
    day: int,
) -> list[PlantStressReport]:
    """
    Runs all 7 stress checks from 04_Plant_Stress_and_Response_Guide.md.
    Returns a list of PlantStressReport for any threshold breached.

    Severity is a float [0.0, 1.0]:
      0.0-0.3  = mild (log only, planner ignores below threshold 0.4)
      0.4-0.6  = moderate (planner adjusts setpoints)
      0.7-1.0  = severe (planner emergency override)

    AI stress response logic from doc 04:
      1. Detect anomaly (sensor data)     ← done here
      2. Match symptoms to stressor       ← done here
      3. Validate via secondary indicator ← done here (cross-check sensors)
      4. Trigger corrective action        ← done in planner.stress_respond()
      5. Monitor recovery                 ← done in next sol's crops.py call
    """
    reports: list[PlantStressReport] = []

    # ── 1. Water stress ───────────────────────────────────────────────────────
    if state.water_liters_available < 50.0:
        severity = 1.0 - (state.water_liters_available / 50.0)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.WATER_DROUGHT,
            severity           = round(severity, 2),
            recommended_action = "Increase irrigation rate. Check water recycling system.",
            day_detected       = day,
        ))

    elif state.water_liters_available > 800.0:
        # Overwatering — roots can't breathe
        severity = min((state.water_liters_available - 800.0) / 400.0, 1.0)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.WATER_OVERWATER,
            severity           = round(severity, 2),
            recommended_action = "Reduce irrigation. Increase aeration in root zone.",
            day_detected       = day,
        ))

    # ── 2. Salinity stress (EC) ───────────────────────────────────────────────
    if state.ec_ms_cm > 4.0:
        severity = min((state.ec_ms_cm - 4.0) / 2.0, 1.0)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.SALINITY,
            severity           = round(severity, 2),
            recommended_action = "Dilute nutrient solution. Flush with fresh water.",
            day_detected       = day,
        ))

    # ── 3. Temperature stress ─────────────────────────────────────────────────
    if state.temp_celsius > profile.temp_stress_above:
        severity = min((state.temp_celsius - profile.temp_stress_above) / 10.0, 1.0)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.HEAT,
            severity           = round(severity, 2),
            recommended_action = "Increase ventilation. Reduce LED intensity to cut heat load.",
            day_detected       = day,
        ))

    elif state.temp_celsius < profile.temp_min_celsius:
        severity = min((profile.temp_min_celsius - state.temp_celsius) / 10.0, 1.0)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.COLD,
            severity           = round(severity, 2),
            recommended_action = "Increase heating. Check thermal insulation integrity.",
            day_detected       = day,
        ))

    # ── 4. Nutrient deficiencies ──────────────────────────────────────────────
    # Nitrogen: yellowing of older leaves. Threshold: < 80 ppm
    if state.nutrient_n_ppm < 80.0:
        severity = 1.0 - (state.nutrient_n_ppm / 80.0)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.NUTRIENT_N,
            severity           = round(severity, 2),
            recommended_action = "Increase nitrogen concentration in nutrient solution.",
            day_detected       = day,
        ))

    # Potassium: leaf edge browning. Threshold: < 100 ppm
    if state.nutrient_k_ppm < 100.0:
        severity = 1.0 - (state.nutrient_k_ppm / 100.0)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.NUTRIENT_K,
            severity           = round(severity, 2),
            recommended_action = "Adjust potassium concentration. Check pH — affects K uptake.",
            day_detected       = day,
        ))

    # Iron: yellowing of young leaves. Threshold: < 0.5 ppm
    if state.nutrient_fe_ppm < 0.5:
        severity = 1.0 - (state.nutrient_fe_ppm / 0.5)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.NUTRIENT_FE,
            severity           = round(severity, 2),
            recommended_action = "Add chelated iron. Adjust pH to 5.5-6.5 to improve Fe uptake.",
            day_detected       = day,
        ))

    # ── 5. Light stress ───────────────────────────────────────────────────────
    if state.par_umol_m2s < profile.par_min_umol:
        severity = 1.0 - (state.par_umol_m2s / profile.par_min_umol)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.LIGHT_LOW,
            severity           = round(severity, 2),
            recommended_action = "Increase LED intensity. Check for dust on grow panels.",
            day_detected       = day,
        ))

    elif state.par_umol_m2s > profile.par_max_umol * 1.5:
        severity = min((state.par_umol_m2s - profile.par_max_umol * 1.5) / 200.0, 1.0)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.LIGHT_HIGH,
            severity           = round(severity, 2),
            recommended_action = "Reduce LED intensity. Risk of photobleaching.",
            day_detected       = day,
        ))

    # ── 6. CO2 imbalance ─────────────────────────────────────────────────────
    if state.co2_ppm < 400.0:
        severity = 1.0 - (state.co2_ppm / 400.0)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.CO2_LOW,
            severity           = round(severity, 2),
            recommended_action = "Increase CO2 enrichment. Check injector system.",
            day_detected       = day,
        ))

    elif state.co2_ppm > 1500.0:
        # Human safety — severity always critical
        severity = min((state.co2_ppm - 1500.0) / 500.0 + 0.7, 1.0)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.CO2_HIGH,
            severity           = round(severity, 2),
            recommended_action = "CRITICAL: Emergency ventilation. Human safety risk.",
            day_detected       = day,
        ))

    # ── 7. Root hypoxia ───────────────────────────────────────────────────────
    # Proxy: low water + high EC = nutrient solution too concentrated
    # Also triggered by EC spike from nutrient contamination
    if state.ec_ms_cm > 3.5 and state.water_liters_available < 150.0:
        severity = min(((state.ec_ms_cm - 3.5) / 1.5) * 0.8, 1.0)
        reports.append(PlantStressReport(
            crop_type          = profile.crop_type,
            stress_type        = StressType.ROOT_HYPOXIA,
            severity           = round(severity, 2),
            recommended_action = "Flush root zone. Increase dissolved oxygen. Dilute solution.",
            day_detected       = day,
        ))

    return reports


# ─────────────────────────────────────────────────────────────────────────────
# YIELD PROJECTION
# Given how well the crop grew, what will we actually harvest?
# ─────────────────────────────────────────────────────────────────────────────

def _project_yield(
    profile: CropProfile,
    cumulative_growth: float,
    days_grown: int,
    area_m2: float,
) -> float:
    """
    Projects harvest yield in kg/m² based on cumulative growth performance.

    Method:
      - Perfect conditions (cumulative_growth = days_grown) → max yield
      - Zero growth → min yield (plant survived but didn't thrive)
      - Linear interpolation between min and max yield

    cumulative_growth is the sum of daily growth_rate values.
    Perfect score = days_grown (every day was 1.0).
    Growth efficiency = cumulative_growth / days_grown.
    """
    if days_grown == 0:
        return 0.0

    growth_efficiency = min(cumulative_growth / days_grown, 1.0)

    yield_range   = profile.yield_kg_m2_max - profile.yield_kg_m2_min
    projected_m2  = profile.yield_kg_m2_min + (yield_range * growth_efficiency)

    # Apply harvest index — only edible fraction counts
    edible_kg_m2 = projected_m2 * profile.harvest_index

    return round(edible_kg_m2 * area_m2, 2)


# ─────────────────────────────────────────────────────────────────────────────
# RESOURCE CONSUMPTION
# How much water and nutrients did the crops drink today?
# ─────────────────────────────────────────────────────────────────────────────

def _compute_resource_consumption(
    active_crops: dict[CropType, dict],
    state: GreenhouseState,
    profiles: dict[CropType, CropProfile],
) -> tuple[float, float, float]:
    """
    Estimates daily resource consumption across all active crops.

    Water:      ~3-5 L/m²/day in hydroponics (doc 02)
    Nitrogen:   ~10-20 ppm consumed per day per active crop zone
    Potassium:  ~15-25 ppm consumed per day per active crop zone

    Returns: (water_liters, n_ppm_consumed, k_ppm_consumed)
    """
    total_water = 0.0
    total_n     = 0.0
    total_k     = 0.0

    for crop_type, crop_data in active_crops.items():
        area_m2  = crop_data.get("area_m2", 10.0)
        profile  = profiles[crop_type]

        # Water consumption scales with area and growth stage
        days_grown      = state.day - crop_data.get("day_planted", 0)
        cycle_mid       = (profile.growth_cycle_days_min + profile.growth_cycle_days_max) / 2
        maturity_factor = min(days_grown / cycle_mid, 1.0)

        # Peak water use at ~70% maturity (vegetative growth phase)
        water_factor    = 1.0 - abs(maturity_factor - 0.7) * 0.5
        water_per_m2    = 3.0 + (2.0 * water_factor)   # 3-5 L/m²/day
        total_water    += water_per_m2 * area_m2

        # Nutrient consumption (higher in fast-growing crops)
        total_n += 15.0 * maturity_factor
        total_k += 20.0 * maturity_factor

    return round(total_water, 1), round(total_n, 1), round(total_k, 1)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def simulate_crops(
    state: GreenhouseState,
    active_crops: dict[CropType, dict],
    profiles: dict[CropType, CropProfile] | None = None,
) -> SimulationResult:
    """
    Run one sol of crop simulation for all active crop batches.

    Args:
        state        : today's GreenhouseState (output of martian.simulate_sol)
        active_crops : dict[CropType → {day_planted, area_m2, cumulative_growth}]
                       maintained and mutated by main.py each sol
        profiles     : crop profiles (defaults to knowledge-base values)

    Returns:
        SimulationResult with per-crop statuses, stress reports,
        yield projections, and resource consumption.

    Note on active_crops format:
        main.py stores richer data than just {CropType: day_planted}.
        Each entry is a dict:
          {
            "day_planted":        int,
            "area_m2":            float,
            "cumulative_growth":  float,   ← updated here each sol
          }
        main.py updates cumulative_growth with today's growth_rate
        after this function returns.
    """
    if profiles is None:
        profiles = default_crop_profiles()

    crop_statuses:     list[CropStatus]        = []
    all_stress_reports: list[PlantStressReport] = []

    total_yield_kg          = 0.0
    total_standing_kcal     = 0.0
    total_standing_protein  = 0.0
    total_harvested_kcal    = 0.0
    total_harvested_protein = 0.0
    total_harvested_yield   = 0.0

    logger.info("--- Sol %d crop simulation (%d active crops) ---",
                state.day, len(active_crops))

    for crop_type, crop_data in active_crops.items():
        profile     = profiles[crop_type]
        day_planted = crop_data["day_planted"]
        area_m2     = crop_data["area_m2"]
        cum_growth  = crop_data.get("cumulative_growth", 0.0)
        days_grown  = state.day - day_planted

        # ── Growth rate for today ─────────────────────────────────────────────
        growth_rate = _compute_growth_rate(state, profile)

        # ── Stress detection ──────────────────────────────────────────────────
        stress_reports = _detect_stress(state, profile, state.day)
        all_stress_reports.extend(stress_reports)

        # ── Yield projection ──────────────────────────────────────────────────
        new_cumulative = cum_growth + growth_rate
        projected_yield = _project_yield(profile, new_cumulative, days_grown + 1, area_m2)

        # ── Nutrition accounting ──────────────────────────────────────────────
        # Standing crop value — what the whole field is worth right now
        # This is for forecasting only, NOT for daily nutrition scoring
        standing_kcal    = (projected_yield * 1000 / 100) * profile.kcal_per_100g
        standing_protein = (projected_yield * 1000 / 100) * profile.protein_g_per_100g
        total_yield_kg  += projected_yield
        total_standing_kcal    += standing_kcal
        total_standing_protein += standing_protein

        # Harvested today — only counts on actual harvest day
        # On sol 22 when radish is ready: we get real food
        # On sol 21 when radish is growing: we get zero food from greenhouse
        if days_grown >= profile.growth_cycle_days_min:
            harvested_kcal    = standing_kcal
            harvested_protein = standing_protein
            harvested_yield   = projected_yield
        else:
            harvested_kcal    = 0.0
            harvested_protein = 0.0
            harvested_yield   = 0.0

        total_harvested_kcal    += harvested_kcal
        total_harvested_protein += harvested_protein
        total_harvested_yield   += harvested_yield

        # ── Harvest readiness ─────────────────────────────────────────────────
        days_to_harvest = max(profile.growth_cycle_days_min - days_grown, 0)
        ready           = days_grown >= profile.growth_cycle_days_min

        # ── Build CropStatus ──────────────────────────────────────────────────
        status = CropStatus(
            crop_type            = crop_type,
            day_planted          = day_planted,
            days_grown           = days_grown,
            growth_rate_today    = growth_rate,
            cumulative_growth    = round(new_cumulative, 3),
            projected_yield_kg_m2 = round(projected_yield / area_m2, 3) if area_m2 > 0 else 0.0,
            stress_reports       = stress_reports,
            is_stressed          = len(stress_reports) > 0,
            days_to_min_harvest  = days_to_harvest,
            ready_to_harvest     = ready,
        )
        crop_statuses.append(status)

        # ── Update cumulative growth in main.py's active_crops dict ──────────
        # main.py reads this back after simulate_crops() returns
        crop_data["cumulative_growth"] = round(new_cumulative, 3)

        logger.info(
            "Sol %d | %s | grown=%dd | rate=%.2f | yield=%.2fkg | stress=%d | ready=%s",
            state.day, crop_type.value, days_grown,
            growth_rate, projected_yield,
            len(stress_reports), ready,
        )

    # ── Resource consumption ──────────────────────────────────────────────────
    water_used, n_consumed, k_consumed = _compute_resource_consumption(
        active_crops, state, profiles
    )

    result = SimulationResult(
        day                       = state.day,
        crop_statuses             = crop_statuses,
        all_stress_reports        = all_stress_reports,
        daily_harvested_yield_kg  = round(total_harvested_yield, 2),
        daily_harvested_kcal      = round(total_harvested_kcal, 1),
        daily_harvested_protein_g = round(total_harvested_protein, 1),
        standing_crop_kcal        = round(total_standing_kcal, 1),
        standing_crop_protein_g   = round(total_standing_protein, 1),
        total_projected_yield_kg  = round(total_yield_kg, 2),
        water_consumed_liters     = water_used,
        nutrient_n_consumed_ppm   = n_consumed,
        nutrient_k_consumed_ppm   = k_consumed,
    )

    logger.info(
        "Sol %d crop sim complete | yield=%.1fkg | kcal=%.0f | "
        "protein=%.1fg | stress_reports=%d",
        state.day,
        total_yield_kg, total_harvested_kcal,
        total_harvested_protein, len(all_stress_reports),
    )

    return result