"""
server/agent/models.py

All typed data structures consumed by planner.py.
Derived from the Syngenta mars-crop-knowledge-base (7 documents).
Nothing here does computation — pure data.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ──────────────────────────────────────────────
# ENUMS
# ──────────────────────────────────────────────

class CropType(str, Enum):
    LETTUCE  = "lettuce"
    POTATO   = "potato"
    RADISH   = "radish"
    LEGUME   = "legume"
    HERB     = "herb"


class StressType(str, Enum):
    WATER_DROUGHT    = "water_drought"
    WATER_OVERWATER  = "water_overwater"
    SALINITY         = "salinity"
    HEAT             = "heat"
    COLD             = "cold"
    NUTRIENT_N       = "nutrient_nitrogen"
    NUTRIENT_K       = "nutrient_potassium"
    NUTRIENT_FE      = "nutrient_iron"
    LIGHT_LOW        = "light_low"
    LIGHT_HIGH       = "light_high"
    CO2_LOW          = "co2_low"
    CO2_HIGH         = "co2_high"
    ROOT_HYPOXIA     = "root_hypoxia"
    NONE             = "none"


class GrowthSystem(str, Enum):
    NFT        = "nutrient_film_technique"
    DWC        = "deep_water_culture"
    DRIP       = "drip_irrigation"
    AEROPONICS = "aeroponics"


# ──────────────────────────────────────────────
# MARS ENVIRONMENT  (from doc 01)
# ──────────────────────────────────────────────

@dataclass
class MarsEnvironment:
    """Physical constants of the Mars surface. Treated as read-only by planner."""
    gravity_ms2: float = 3.721          # 38% of Earth
    solar_irradiance_wm2: float = 590   # 43% of Earth
    atmosphere_co2_pct: float = 95.32
    surface_pressure_mbar: float = 6.5  # avg of 6-7 mbar
    avg_temp_celsius: float = -63.0
    temp_min_celsius: float = -140.0
    temp_max_celsius: float = 21.0
    has_magnetic_field: bool = False
    soil_perchlorate_contaminated: bool = True


# ──────────────────────────────────────────────
# GREENHOUSE STATE  (from doc 02)
# ──────────────────────────────────────────────

@dataclass
class GreenhouseState:
    """
    Current sensor readings inside the greenhouse.
    Updated each simulated day by martian.py / resources.py.
    Planner reads this; does not write to it.
    """
    day: int = 0

    # Climate
    temp_celsius: float = 20.0
    humidity_rh: float = 60.0          # %
    co2_ppm: float = 1000.0            # target: 800-1200 ppm

    # Lighting
    par_umol_m2s: float = 200.0        # photosynthetically active radiation

    # Nutrients / water
    ph: float = 6.0                    # target: 5.5-6.5
    ec_ms_cm: float = 2.0              # electrical conductivity
    water_liters_available: float = 500.0
    nutrient_n_ppm: float = 150.0
    nutrient_k_ppm: float = 200.0
    nutrient_fe_ppm: float = 2.0

    # Power
    power_kwh_available: float = 50.0

    # System
    growth_system: GrowthSystem = GrowthSystem.NFT
    total_area_m2: float = 100.0       # total greenhouse floor area


# ──────────────────────────────────────────────
# CROP PROFILE  (from doc 03)
# ──────────────────────────────────────────────

@dataclass
class CropProfile:
    """
    Static characteristics of a crop type.
    Source: 03_Crop_Profiles_Extended.md
    """
    crop_type: CropType

    # Growth
    growth_cycle_days_min: int = 30
    growth_cycle_days_max: int = 45
    yield_kg_m2_min: float = 3.0
    yield_kg_m2_max: float = 5.0
    harvest_index: float = 0.8         # fraction of biomass that is edible

    # Environment tolerances
    temp_min_celsius: float = 15.0
    temp_max_celsius: float = 22.0
    temp_stress_above: float = 25.0    # heat stress threshold
    humidity_min_rh: float = 50.0
    humidity_max_rh: float = 70.0
    par_min_umol: float = 150.0
    par_max_umol: float = 250.0

    # Nutrition per 100g edible
    kcal_per_100g: float = 15.0
    protein_g_per_100g: float = 1.5
    carbs_g_per_100g: float = 2.0

    # Strategic role (qualitative)
    role: str = "micronutrient stabilizer"


def default_crop_profiles() -> dict[CropType, CropProfile]:
    """Returns the 5 crop profiles from the knowledge base."""
    return {
        CropType.LETTUCE: CropProfile(
            crop_type=CropType.LETTUCE,
            growth_cycle_days_min=30, growth_cycle_days_max=45,
            yield_kg_m2_min=3.0,     yield_kg_m2_max=5.0,
            harvest_index=0.8,
            temp_min_celsius=15.0,   temp_max_celsius=22.0, temp_stress_above=25.0,
            humidity_min_rh=50.0,    humidity_max_rh=70.0,
            par_min_umol=150.0,      par_max_umol=250.0,
            kcal_per_100g=15.0,      protein_g_per_100g=1.5, carbs_g_per_100g=2.0,
            role="micronutrient stabilizer",
        ),
        CropType.POTATO: CropProfile(
            crop_type=CropType.POTATO,
            growth_cycle_days_min=70, growth_cycle_days_max=120,
            yield_kg_m2_min=4.0,      yield_kg_m2_max=8.0,
            harvest_index=0.75,
            temp_min_celsius=16.0,    temp_max_celsius=20.0, temp_stress_above=26.0,
            humidity_min_rh=50.0,     humidity_max_rh=70.0,
            par_min_umol=200.0,       par_max_umol=400.0,
            kcal_per_100g=77.0,       protein_g_per_100g=2.0, carbs_g_per_100g=17.0,
            role="primary energy backbone",
        ),
        CropType.RADISH: CropProfile(
            crop_type=CropType.RADISH,
            growth_cycle_days_min=21, growth_cycle_days_max=30,
            yield_kg_m2_min=2.0,      yield_kg_m2_max=4.0,
            harvest_index=0.75,
            temp_min_celsius=15.0,    temp_max_celsius=22.0, temp_stress_above=25.0,
            humidity_min_rh=50.0,     humidity_max_rh=70.0,
            par_min_umol=150.0,       par_max_umol=250.0,
            kcal_per_100g=16.0,       protein_g_per_100g=0.7, carbs_g_per_100g=3.4,
            role="fast buffer crop / diet diversity",
        ),
        CropType.LEGUME: CropProfile(
            crop_type=CropType.LEGUME,
            growth_cycle_days_min=50, growth_cycle_days_max=70,
            yield_kg_m2_min=2.0,      yield_kg_m2_max=4.0,
            harvest_index=0.7,
            temp_min_celsius=18.0,    temp_max_celsius=25.0, temp_stress_above=28.0,
            humidity_min_rh=50.0,     humidity_max_rh=70.0,
            par_min_umol=150.0,       par_max_umol=300.0,
            kcal_per_100g=100.0,      protein_g_per_100g=7.0, carbs_g_per_100g=15.0,
            role="primary plant protein source",
        ),
        CropType.HERB: CropProfile(
            crop_type=CropType.HERB,
            growth_cycle_days_min=21, growth_cycle_days_max=40,
            yield_kg_m2_min=0.5,      yield_kg_m2_max=1.5,
            harvest_index=0.9,
            temp_min_celsius=15.0,    temp_max_celsius=25.0, temp_stress_above=28.0,
            humidity_min_rh=50.0,     humidity_max_rh=70.0,
            par_min_umol=100.0,       par_max_umol=200.0,
            kcal_per_100g=30.0,       protein_g_per_100g=2.5, carbs_g_per_100g=5.0,
            role="psychological well-being / palatability",
        ),
    }


# ──────────────────────────────────────────────
# AREA ALLOCATION  (planner output)
# ──────────────────────────────────────────────

@dataclass
class AreaAllocation:
    """
    How the planner decides to split greenhouse floor space.
    Percentages must sum to 1.0.
    Derived from strategic model in doc 03.
    """
    potato_pct: float  = 0.45   # 40-50% recommended
    legume_pct: float  = 0.25   # 20-30%
    lettuce_pct: float = 0.18   # 15-20%
    radish_pct: float  = 0.07   # 5-10%
    herb_pct: float    = 0.05   # remainder

    def validate(self) -> bool:
        total = (self.potato_pct + self.legume_pct +
                 self.lettuce_pct + self.radish_pct + self.herb_pct)
        return abs(total - 1.0) < 0.001


# ──────────────────────────────────────────────
# HUMAN NUTRITION NEEDS  (from doc 05)
# ──────────────────────────────────────────────

@dataclass
class CrewNutritionNeeds:
    """
    Daily nutritional targets for the full crew of 4 astronauts.
    Source: 05_Human_Nutritional_Strategy.md
    """
    crew_size: int = 4
    mission_duration_days: int = 450

    # Per-crew daily totals
    kcal_per_day: float = 12000.0       # 3000 kcal × 4
    protein_g_per_day: float = 450.0    # midpoint of 360-540g range
    water_liters_per_day: float = 9.0   # midpoint of 8-10L range

    # Macro ratios (target percentages of calories)
    carbs_pct: float = 0.50             # 45-55%
    protein_pct: float = 0.175          # 15-20%
    fat_pct: float = 0.325              # 30-35%

    # Priority ordering (1 = highest)
    priority_1: str = "caloric sufficiency"
    priority_2: str = "protein supply"
    priority_3: str = "micronutrient diversity"
    priority_4: str = "psychological satisfaction"


# ──────────────────────────────────────────────
# PLANT STRESS STATE  (from doc 04)
# ──────────────────────────────────────────────

@dataclass
class PlantStressReport:
    """
    Output from the simulation layer describing detected stresses.
    Planner uses this to trigger corrective schedule adjustments.
    """
    crop_type: CropType
    stress_type: StressType = StressType.NONE
    severity: float = 0.0              # 0.0 = none, 1.0 = critical
    recommended_action: str = ""
    day_detected: int = 0


# ──────────────────────────────────────────────
# PLANTING EVENT  (planner output)
# ──────────────────────────────────────────────

@dataclass
class PlantingEvent:
    """
    A single scheduled action produced by planner.py.
    """
    day: int
    crop_type: CropType
    area_m2: float
    expected_harvest_day: int
    growth_system: GrowthSystem
    target_par: float
    target_temp: float
    target_co2_ppm: float
    target_ph: float
    notes: str = ""


# ──────────────────────────────────────────────
# DAILY SCHEDULE  (planner output)
# ──────────────────────────────────────────────

@dataclass
class DailySchedule:
    """
    Everything the planner decides for a given sol (Martian day).
    This is what gets serialised by schemas.py and sent to the frontend.
    """
    day: int
    area_allocation: AreaAllocation
    planting_events: list[PlantingEvent] = field(default_factory=list)
    harvest_events: list[CropType] = field(default_factory=list)
    stress_responses: list[PlantStressReport] = field(default_factory=list)
    projected_kcal_today: float = 0.0
    projected_protein_g_today: float = 0.0
    water_used_liters: float = 0.0
    notes: str = ""