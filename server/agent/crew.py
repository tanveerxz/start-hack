"""
server/agent/crew.py

Dynamic crew simulation for the Mars greenhouse mission.
Generates 4 astronauts with individual profiles on mission start,
then updates their state each sol with random health events.

Why this exists:
  The original system treated 4 astronauts as a single aggregate
  (12,000 kcal/day flat). In reality each astronaut has different
  body mass, age, role, and daily activity — and these vary sol to sol
  based on EVA schedules, illness, and injury. The RL agent learns
  to feed the worst-fed individual, not just the crew average.

Key design decisions:
  - Separate random.Random instance so crew randomness is isolated
    from the environment simulation's random sequence
  - Harris-Benedict equation for realistic base metabolic rates
  - Profile-adjusted event probabilities (age, role, weight all matter)
  - Cumulative fatigue — EVA history increases injury risk over time
  - Recovery immunity — can't get ill again immediately after recovery
  - Medic cascade — if Medic is ill, everyone recovers slower
  - Triage flag — 3 consecutive sols below 50% triggers planner override
  - Food distribution is needs-weighted, not equal split
  - Coverage capped at 100% per astronaut per day (burst harvests)

Call order in main.py each sol:
  1. crew.generate_crew()      → called ONCE at mission start
  2. crew.update_crew_sol()    → called every sol, after resources.update()
"""

from __future__ import annotations
import random
import logging
import math
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

# Fixed name pool — curated to avoid encoding issues and be realistic
# 10 female names, 10 male names — crew generation picks 4 randomly
ASTRONAUT_NAMES_F = [
    "Dr Sarah Chen",
    "Commander Priya Kapoor",
    "Dr Amara Osei",
    "Lt Elena Vasquez",
    "Dr Fatima Al-Rashid",
    "Commander Yuki Tanaka",
    "Dr Maria Santos",
    "Lt Aisha Nkosi",
    "Dr Claire Dubois",
    "Commander Ingrid Larsson",
]

ASTRONAUT_NAMES_M = [
    "Commander Marcus Webb",
    "Dr James Okafor",
    "Lt Raj Patel",
    "Dr Aleksei Volkov",
    "Commander Carlos Rivera",
    "Dr Ben Nakamura",
    "Lt Omar Hassan",
    "Dr Thomas Müller",
    "Commander David Kim",
    "Lt Samuel Adeyemi",
]

# The 4 roles — each has distinct activity profile
# Order matters: index 0=Commander, 1=Engineer, 2=Scientist, 3=Medic
ROLES = ["Commander", "Engineer", "Scientist", "Medic"]

# Role-based baseline probabilities (per sol per astronaut)
# These are multiplied by individual profile modifiers
ROLE_EVA_PROB = {
    "Commander":  0.15,   # most EVAs — leads surface operations
    "Engineer":   0.12,   # frequent EVAs — maintains external systems
    "Scientist":  0.04,   # occasional EVAs — sample collection only
    "Medic":      0.03,   # rare EVAs — stays inside to treat crew
}

ROLE_REST_PROB = {
    "Commander":  0.06,   # rarely rests — mission pressure
    "Engineer":   0.08,
    "Scientist":  0.10,
    "Medic":      0.09,
}

# Base illness/injury probabilities (before age/weight modifiers)
BASE_ILLNESS_PROB  = 0.004   # 0.4% per sol — calibrated for ~5-10 illness episodes per mission
BASE_INJURY_PROB   = 0.001   # 0.1% per sol — calibrated for ~2-4 injury episodes per mission

# Fatigue rate — injury probability increases by this per EVA completed
FATIGUE_RATE = 0.00005       # +0.005% per EVA done — subtle long-term effect

# Maximum injury probability regardless of fatigue (cap at 8%)
MAX_INJURY_PROB = 0.08

# Recovery probabilities per sol
BASE_RECOVERY_PROB_ILLNESS = 0.30   # 30% chance of recovering from illness each sol
BASE_RECOVERY_PROB_INJURY  = 0.20   # 20% chance of recovering from injury each sol (~5 sol avg)

# Medic effect on crew recovery — multiplier applied when Medic is healthy
MEDIC_RECOVERY_BOOST = 1.20        # 20% faster recovery when Medic is nominal
MEDIC_INJURED_PENALTY = 0.70       # 30% slower recovery when Medic is injured/ill

# Recovery immunity — sols after recovery before can get ill again
RECOVERY_IMMUNITY_SOLS = 6

# Triage threshold — if any astronaut is below this coverage for this many
# consecutive sols, planner enters triage mode
TRIAGE_COVERAGE_THRESHOLD = 0.50   # 50% individual coverage
TRIAGE_CONSECUTIVE_SOLS    = 3     # 3 sols triggers triage

# Nutritional need bounds — Harris-Benedict outputs clamped to these
MIN_KCAL_PER_DAY    = 1500.0
MAX_KCAL_PER_DAY    = 4000.0
MIN_PROTEIN_PER_DAY = 50.0
MAX_PROTEIN_PER_DAY = 200.0

# EVA nutritional costs
EVA_EXTRA_KCAL    = 600.0    # extra calories needed on EVA day
EVA_EXTRA_PROTEIN = 40.0     # extra protein needed on EVA day

# Illness nutritional multiplier
ILLNESS_KCAL_MULTIPLIER    = 1.20   # 20% more calories when ill
ILLNESS_PROTEIN_MULTIPLIER = 1.20

# Injury nutritional multiplier
INJURY_KCAL_MULTIPLIER    = 1.10   # 10% more calories when injured
INJURY_PROTEIN_MULTIPLIER = 1.30   # 30% more protein when injured (tissue repair)

# High stress nutritional multiplier
STRESS_KCAL_MULTIPLIER    = 1.15
STRESS_PROTEIN_MULTIPLIER = 1.10

# Rest day adjustment
REST_DAY_KCAL_REDUCTION = 200.0    # fewer calories needed on rest day

# Water consumption per astronaut per sol (base)
BASE_WATER_PER_ASTRONAUT = 2.25    # 9L / 4 crew
EVA_EXTRA_WATER           = 1.5    # extra water on EVA day

# Critical crew health — if this many or more crew are ill/injured simultaneously
CREW_CRITICAL_THRESHOLD = 2        # 2+ crew ill/injured = critical event


# ─────────────────────────────────────────────────────────────────────────────
# DATACLASSES
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class AstronautProfile:
    """
    Fixed biological and role profile for one astronaut.
    Generated once at mission start. Never changes during mission.
    """
    name:               str
    role:               str         # Commander / Engineer / Scientist / Medic
    age:                int         # 28-50
    sex:                str         # M / F
    weight_kg:          float       # 55-95 kg

    # Computed from Harris-Benedict at profile generation
    base_kcal_per_day:     float    # resting metabolic rate
    base_protein_g_per_day: float   # 1.6g per kg bodyweight

    # Role + age + weight adjusted event probabilities
    # These are the per-sol baseline probabilities for this individual
    eva_prob:           float
    illness_prob:       float
    injury_prob:        float
    rest_prob:          float
    fatigue_rate:       float       # how fast injury risk grows with EVA count


@dataclass
class AstronautDailyState:
    """
    The state of one astronaut on a specific sol.
    Computed fresh each sol by update_crew_sol().
    """
    profile:            AstronautProfile

    # Today's nutritional needs (modified by active conditions)
    kcal_needed_today:      float
    protein_needed_today:   float
    water_needed_today:     float

    # Health
    health_status:      str             # nominal / ill / injured / high_stress / recovering
    active_conditions:  list[str]       # e.g. ["eva_day", "light_illness"]
    illness_days_remaining:  int        # sols until illness resolves (0 if not ill)
    injury_days_remaining:   int        # sols until injury resolves
    immunity_sols_remaining: int        # post-recovery immunity window

    # Coverage — filled in after food distribution
    kcal_coverage_pct:      float = 0.0   # capped at 100%
    protein_coverage_pct:   float = 0.0

    # Cumulative mission stats
    days_on_mission:    int = 0
    total_evas:         int = 0
    total_illness_days: int = 0
    total_injury_days:  int = 0

    # Triage tracking — consecutive sols below coverage threshold
    consecutive_low_coverage_sols: int = 0


@dataclass
class CrewDailyState:
    """
    Full crew state for one sol.
    Consumed by reward.py, planner.py, rl_agent.py, and schemas.py.
    """
    astronauts:             list[AstronautDailyState]

    # Crew totals (sum of individual needs)
    total_kcal_needed:      float
    total_protein_needed:   float
    total_water_needed:     float

    # Coverage metrics
    avg_kcal_coverage:      float   # crew average
    min_kcal_coverage:      float   # worst-fed astronaut (key RL feature)
    avg_protein_coverage:   float
    min_protein_coverage:   float

    # Health summary
    avg_health_score:       float   # 0.0 (all critical) → 1.0 (all nominal)
    crew_need_variance:     float   # std deviation of individual kcal needs / max_need

    # Flags for reward.py and planner.py
    any_in_triage:          bool    # any astronaut needs emergency food priority
    triage_astronaut:       Optional[str]  # name of astronaut in triage
    crew_critical:          bool    # 2+ crew simultaneously ill/injured
    medic_available:        bool    # is the Medic healthy enough to treat crew

    # Cumulative mission crew stats
    total_mission_evas:         int
    total_mission_illness_days: int
    total_mission_injury_days:  int


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL STATE
# Mutable state that persists between sol calls
# Stored here rather than in main.py to keep crew logic encapsulated
# ─────────────────────────────────────────────────────────────────────────────

# Separate Random instance — completely isolated from environment simulation
# Seeded from mission_seed passed into generate_crew()
_crew_rng: random.Random = random.Random()

# Per-astronaut mutable tracking state (indexed by astronaut name)
_astronaut_state: dict[str, dict] = {}


# ─────────────────────────────────────────────────────────────────────────────
# HARRIS-BENEDICT EQUATION
# Computes resting metabolic rate from biological stats
# ─────────────────────────────────────────────────────────────────────────────

def _harris_benedict(sex: str, weight_kg: float, age: int) -> float:
    """
    Harris-Benedict equation for Basal Metabolic Rate (BMR).
    Multiplied by 1.55 (moderately active) to get daily calorie need.

    Male:   BMR = 88.362 + (13.397 × weight) + (4.799 × height) - (5.677 × age)
    Female: BMR = 447.593 + (9.247 × weight) + (3.098 × height) - (4.330 × age)

    We estimate height from weight using a realistic BMI of 22-24.
    Astronauts are physically fit so BMI skews toward 22.

    Returns: daily kcal need (clamped to MIN/MAX bounds)
    """
    # Estimate height from weight assuming BMI ~22.5
    bmi   = 22.5
    height_m = math.sqrt(weight_kg / bmi)
    height_cm = height_m * 100

    if sex == "M":
        bmr = 88.362 + (13.397 * weight_kg) + (4.799 * height_cm) - (5.677 * age)
    else:
        bmr = 447.593 + (9.247 * weight_kg) + (3.098 * height_cm) - (4.330 * age)

    # Astronauts are moderately-to-very active — use activity factor 1.55
    daily_kcal = bmr * 1.55

    return max(MIN_KCAL_PER_DAY, min(MAX_KCAL_PER_DAY, round(daily_kcal, 0)))


# ─────────────────────────────────────────────────────────────────────────────
# PROFILE GENERATION
# Age and weight modifiers for event probabilities
# ─────────────────────────────────────────────────────────────────────────────

def _compute_event_probabilities(
    role: str,
    age: int,
    weight_kg: float,
    sex: str,
) -> tuple[float, float, float, float, float]:
    """
    Compute per-sol event probabilities for this astronaut profile.

    Age effect:
      - Illness: +0.003 per year above 35 (older = more susceptible)
      - Injury:  +0.002 per year above 35

    Weight effect:
      - Heavier = more muscle mass = lower illness susceptibility (-0.001 per 10kg above 70)
      - But heavier = more joint stress = higher injury risk (+0.0005 per 10kg above 70)

    Sex effect:
      - Female astronauts statistically have lower injury rates in space (-0.002 on injury)
      - No difference on illness

    Returns: (eva_prob, illness_prob, injury_prob, rest_prob, fatigue_rate)
    """
    base_eva     = ROLE_EVA_PROB[role]
    base_illness = BASE_ILLNESS_PROB
    base_injury  = BASE_INJURY_PROB
    base_rest    = ROLE_REST_PROB[role]

    # Age modifier (above 35)
    age_factor = max(0, age - 35)
    illness_mod = age_factor * 0.003
    injury_mod  = age_factor * 0.002

    # Weight modifier (above 70kg)
    weight_factor = max(0, weight_kg - 70) / 10
    illness_mod -= weight_factor * 0.001   # heavier = lower illness
    injury_mod  += weight_factor * 0.0005  # heavier = more joint stress

    # Sex modifier
    if sex == "F":
        injury_mod -= 0.002

    # Fatigue rate scales with role activity level
    fatigue_rate = FATIGUE_RATE * (base_eva / 0.08)  # normalised to average EVA rate

    return (
        round(max(0.01, min(0.25,  base_eva)),                        4),
        round(max(0.003, min(0.015, base_illness + illness_mod)),     4),  # max 1.5%
        round(max(0.001, min(0.008, base_injury  + injury_mod)),      4),  # max 0.8%
        round(max(0.03, min(0.20,  base_rest)),                       4),
        round(max(0.0001, fatigue_rate),                              5),
    )


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC: GENERATE CREW
# Called once at mission start from main.py lifespan
# ─────────────────────────────────────────────────────────────────────────────

def generate_crew(mission_seed: Optional[int] = None) -> list[AstronautProfile]:
    """
    Generate 4 random astronaut profiles for this mission.

    Uses a separate Random instance (_crew_rng) so crew randomness
    is completely isolated from the environment simulation's random
    sequence. Changing crew code won't alter dust storm timing.

    Args:
        mission_seed: if provided, crew generation is reproducible.
                      If None, fully random each run.

    Returns:
        List of 4 AstronautProfile objects, one per role.
        Roles are always: Commander, Engineer, Scientist, Medic.
        Sex and other attributes are randomised.
    """
    global _crew_rng, _astronaut_state

    _crew_rng = random.Random(mission_seed)
    _astronaut_state = {}

    profiles = []
    used_names = set()

    for role in ROLES:
        # Random sex
        sex = _crew_rng.choice(["M", "F"])

        # Pick name from appropriate pool — no repeats
        name_pool = ASTRONAUT_NAMES_M if sex == "M" else ASTRONAUT_NAMES_F
        available = [n for n in name_pool if n not in used_names]
        name = _crew_rng.choice(available)
        used_names.add(name)

        # Age: 28-50 — realistic astronaut age range
        age = _crew_rng.randint(28, 50)

        # Weight: 55-95kg — realistic range for fit astronauts
        weight_kg = round(_crew_rng.uniform(55.0, 95.0), 1)

        # Base metabolic rate from Harris-Benedict
        base_kcal = _harris_benedict(sex, weight_kg, age)

        # Protein need: 1.6g/kg bodyweight (NASA standard for space missions)
        base_protein = max(
            MIN_PROTEIN_PER_DAY,
            min(MAX_PROTEIN_PER_DAY, round(weight_kg * 1.6, 1))
        )

        # Event probabilities from profile
        eva_prob, illness_prob, injury_prob, rest_prob, fatigue_rate = \
            _compute_event_probabilities(role, age, weight_kg, sex)

        profile = AstronautProfile(
            name               = name,
            role               = role,
            age                = age,
            sex                = sex,
            weight_kg          = weight_kg,
            base_kcal_per_day  = base_kcal,
            base_protein_g_per_day = base_protein,
            eva_prob           = eva_prob,
            illness_prob       = illness_prob,
            injury_prob        = injury_prob,
            rest_prob          = rest_prob,
            fatigue_rate       = fatigue_rate,
        )

        profiles.append(profile)

        # Initialise mutable tracking state for this astronaut
        _astronaut_state[name] = {
            "illness_days_remaining":   0,
            "injury_days_remaining":    0,
            "immunity_sols_remaining":  0,
            "total_evas":               0,
            "total_illness_days":       0,
            "total_injury_days":        0,
            "consecutive_low_coverage": 0,
        }

        logger.info(
            "Crew: %s | %s | age=%d | %s | %.1fkg | "
            "kcal=%.0f | protein=%.0fg | eva=%.0f%% | illness=%.1f%%",
            name, role, age, sex, weight_kg,
            base_kcal, base_protein,
            eva_prob * 100, illness_prob * 100,
        )

    logger.info("Crew of 4 generated for 450-sol mission.")
    return profiles


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL: HEALTH EVENT RESOLUTION
# Apply random events and update mutable state for one astronaut
# ─────────────────────────────────────────────────────────────────────────────

def _resolve_health_events(
    profile: AstronautProfile,
    state:   dict,
    medic_healthy: bool,
) -> tuple[str, list[str]]:
    """
    Resolve today's health events for one astronaut.

    Order of resolution:
      1. Check if existing illness/injury recovers today
      2. If healthy, roll for new events (EVA, illness, injury, stress, rest)
      3. EVA is blocked if ill or injured
      4. Illness is blocked during immunity window

    Args:
        profile:       fixed astronaut profile
        state:         mutable tracking dict for this astronaut
        medic_healthy: affects recovery probability

    Returns:
        (health_status, active_conditions)
    """
    active_conditions = []
    health_status = "nominal"

    # ── Recovery multiplier based on Medic availability ──────────────────────
    recovery_mult = MEDIC_RECOVERY_BOOST if medic_healthy else MEDIC_INJURED_PENALTY

    # ── Step 1: Resolve existing illness ─────────────────────────────────────
    if state["illness_days_remaining"] > 0:
        # Roll for recovery — guaranteed when counter hits 1 (hard cap)
        recovery_prob = BASE_RECOVERY_PROB_ILLNESS * recovery_mult
        if _crew_rng.random() < recovery_prob or state["illness_days_remaining"] == 1:
            state["illness_days_remaining"] = 0
            state["immunity_sols_remaining"] = RECOVERY_IMMUNITY_SOLS
            logger.info("%s recovered from illness.", profile.name)
        else:
            state["illness_days_remaining"] -= 1
            state["total_illness_days"] += 1
            active_conditions.append("light_illness")
            health_status = "ill"

    # ── Step 2: Resolve existing injury ──────────────────────────────────────
    elif state["injury_days_remaining"] > 0:
        recovery_prob = BASE_RECOVERY_PROB_INJURY * recovery_mult
        # injury_days_remaining is a hard cap — guaranteed recovery when it hits 1
        if _crew_rng.random() < recovery_prob or state["injury_days_remaining"] == 1:
            state["injury_days_remaining"] = 0
            state["immunity_sols_remaining"] = RECOVERY_IMMUNITY_SOLS
            logger.info("%s recovered from injury.", profile.name)
        else:
            state["injury_days_remaining"] -= 1
            state["total_injury_days"] += 1
            active_conditions.append("injury")
            health_status = "injured"

    # ── Step 3: Roll for new events if currently healthy ─────────────────────
    else:
        # Tick down immunity window
        if state["immunity_sols_remaining"] > 0:
            state["immunity_sols_remaining"] -= 1

        # Injury probability increases with EVA fatigue
        today_injury_prob = min(
            MAX_INJURY_PROB,
            profile.injury_prob + (profile.fatigue_rate * state["total_evas"])
        )

        # New illness — blocked during immunity window
        if state["immunity_sols_remaining"] == 0:
            if _crew_rng.random() < profile.illness_prob:
                duration = _crew_rng.randint(2, 3)
                state["illness_days_remaining"] = duration
                state["total_illness_days"] += 1
                active_conditions.append("light_illness")
                health_status = "ill"

        # New injury — always possible (accidents happen)
        if health_status == "nominal" and _crew_rng.random() < today_injury_prob:
            duration = _crew_rng.randint(7, 10)
            state["injury_days_remaining"] = duration
            state["total_injury_days"] += 1
            active_conditions.append("injury")
            health_status = "injured"

        # High stress — independent of illness/injury
        if _crew_rng.random() < 0.05:
            active_conditions.append("high_stress")
            if health_status == "nominal":
                health_status = "high_stress"

        # EVA day — blocked if ill or injured
        if health_status == "nominal" and _crew_rng.random() < profile.eva_prob:
            # EVA day — small acute injury risk (0.5x base, not doubled)
            if _crew_rng.random() < today_injury_prob * 0.5:
                duration = _crew_rng.randint(7, 10)
                state["injury_days_remaining"] = _crew_rng.randint(4, 6)
                state["total_injury_days"] += 1
                active_conditions.append("injury")
                health_status = "injured"
                logger.info("%s injured during EVA.", profile.name)
            else:
                active_conditions.append("eva_day")
                state["total_evas"] += 1

        # Rest day — only if no other events fired
        if not active_conditions and _crew_rng.random() < profile.rest_prob:
            active_conditions.append("rest_day")

    return health_status, active_conditions


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL: COMPUTE DAILY NEEDS
# Apply active conditions to base metabolic needs
# ─────────────────────────────────────────────────────────────────────────────

def _compute_daily_needs(
    profile:           AstronautProfile,
    active_conditions: list[str],
) -> tuple[float, float, float]:
    """
    Apply today's active conditions to base metabolic needs.

    Returns: (kcal_needed, protein_needed, water_needed)
    All values are clamped to realistic bounds.
    """
    kcal    = profile.base_kcal_per_day
    protein = profile.base_protein_g_per_day
    water   = BASE_WATER_PER_ASTRONAUT

    for condition in active_conditions:
        if condition == "eva_day":
            kcal    += EVA_EXTRA_KCAL
            protein += EVA_EXTRA_PROTEIN
            water   += EVA_EXTRA_WATER

        elif condition == "light_illness":
            kcal    *= ILLNESS_KCAL_MULTIPLIER
            protein *= ILLNESS_PROTEIN_MULTIPLIER

        elif condition == "injury":
            kcal    *= INJURY_KCAL_MULTIPLIER
            protein *= INJURY_PROTEIN_MULTIPLIER

        elif condition == "high_stress":
            kcal    *= STRESS_KCAL_MULTIPLIER
            protein *= STRESS_PROTEIN_MULTIPLIER

        elif condition == "rest_day":
            kcal = max(MIN_KCAL_PER_DAY, kcal - REST_DAY_KCAL_REDUCTION)

    return (
        round(max(MIN_KCAL_PER_DAY, min(MAX_KCAL_PER_DAY, kcal)), 1),
        round(max(MIN_PROTEIN_PER_DAY, min(MAX_PROTEIN_PER_DAY, protein)), 1),
        round(max(1.0, water), 2),
    )


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL: FOOD DISTRIBUTION
# Distribute harvested food to crew using needs-weighted split
# ─────────────────────────────────────────────────────────────────────────────

def _distribute_food(
    astronauts:       list[AstronautDailyState],
    harvested_kcal:   float,
    harvested_protein: float,
) -> None:
    """
    Distribute today's harvested food across crew using needs-weighted split.

    Why needs-weighted and not equal split:
      On EVA days one astronaut needs 3,800 kcal while a resting astronaut
      needs 1,800. Equal split gives both 2,500 which underfuels the EVA
      astronaut and wastes food on the resting one. Needs-weighted
      gives each person the proportion their need represents of total need.

    Coverage is capped at 100% — burst harvests (potato day: 196,000 kcal)
      would otherwise show 1,500% which is meaningless. The surplus goes
      into stored food (implicit — not modelled explicitly).

    This function mutates the astronaut daily state objects in place.
    """
    total_kcal_need    = sum(a.kcal_needed_today for a in astronauts)
    total_protein_need = sum(a.protein_needed_today for a in astronauts)

    for astronaut in astronauts:
        # Needs-weighted fraction of today's harvest for this astronaut
        kcal_fraction    = astronaut.kcal_needed_today    / total_kcal_need    if total_kcal_need    > 0 else 0.25
        protein_fraction = astronaut.protein_needed_today / total_protein_need if total_protein_need > 0 else 0.25

        kcal_received    = harvested_kcal   * kcal_fraction
        protein_received = harvested_protein * protein_fraction

        # Coverage as percentage of need — capped at 100%
        astronaut.kcal_coverage_pct    = round(min(100.0, (kcal_received    / astronaut.kcal_needed_today)    * 100) if astronaut.kcal_needed_today    > 0 else 0.0, 1)
        astronaut.protein_coverage_pct = round(min(100.0, (protein_received / astronaut.protein_needed_today) * 100) if astronaut.protein_needed_today > 0 else 0.0, 1)


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL: HEALTH SCORE
# Convert health status to numeric score for RL state vector
# ─────────────────────────────────────────────────────────────────────────────

def _health_score(health_status: str) -> float:
    """
    Convert health status string to numeric score [0, 1].
    Used to compute avg_health_score for RL observation.
    """
    return {
        "nominal":     1.0,
        "high_stress": 0.7,
        "recovering":  0.8,
        "ill":         0.4,
        "injured":     0.3,
    }.get(health_status, 1.0)


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC: UPDATE CREW SOL
# Called every sol from main.py after resources.update()
# ─────────────────────────────────────────────────────────────────────────────

def update_crew_sol(
    profiles:          list[AstronautProfile],
    day:               int,
    harvested_kcal:    float,
    harvested_protein: float,
) -> CrewDailyState:
    """
    Run one sol of crew simulation.

    Pipeline:
      1. Check if Medic is healthy (affects everyone's recovery)
      2. For each astronaut:
         a. Resolve health events (recovery or new events)
         b. Compute today's nutritional needs from active conditions
         c. Build AstronautDailyState
      3. Distribute harvested food needs-weighted across crew
      4. Update triage tracking per astronaut
      5. Compute crew-level aggregates
      6. Build and return CrewDailyState

    Args:
        profiles:          list of 4 AstronautProfile (from generate_crew)
        day:               current sol number
        harvested_kcal:    kcal from today's harvest (0 on non-harvest days)
        harvested_protein: protein from today's harvest

    Returns:
        CrewDailyState with full per-astronaut and crew-level data
    """
    # ── Step 1: Determine if Medic is healthy ────────────────────────────────
    medic_profile = next((p for p in profiles if p.role == "Medic"), None)
    medic_state   = _astronaut_state.get(medic_profile.name, {}) if medic_profile else {}
    medic_healthy = (
        medic_state.get("illness_days_remaining", 0) == 0 and
        medic_state.get("injury_days_remaining", 0) == 0
    )

    # ── Step 2: Process each astronaut ───────────────────────────────────────
    daily_states: list[AstronautDailyState] = []

    for profile in profiles:
        state = _astronaut_state[profile.name]

        # Resolve health events
        health_status, active_conditions = _resolve_health_events(
            profile, state, medic_healthy
        )

        # Compute today's needs
        kcal_needed, protein_needed, water_needed = _compute_daily_needs(
            profile, active_conditions
        )

        # Build daily state (coverage filled in during distribution step)
        daily_state = AstronautDailyState(
            profile                      = profile,
            kcal_needed_today            = kcal_needed,
            protein_needed_today         = protein_needed,
            water_needed_today           = water_needed,
            health_status                = health_status,
            active_conditions            = active_conditions,
            illness_days_remaining       = state["illness_days_remaining"],
            injury_days_remaining        = state["injury_days_remaining"],
            immunity_sols_remaining      = state["immunity_sols_remaining"],
            days_on_mission              = day,
            total_evas                   = state["total_evas"],
            total_illness_days           = state["total_illness_days"],
            total_injury_days            = state["total_injury_days"],
            consecutive_low_coverage_sols = state["consecutive_low_coverage"],
        )
        daily_states.append(daily_state)

    # ── Step 3: Distribute food needs-weighted ───────────────────────────────
    _distribute_food(daily_states, harvested_kcal, harvested_protein)

    # ── Step 4: Update triage tracking ──────────────────────────────────────
    triage_astronaut = None
    any_in_triage    = False
    had_harvest      = harvested_kcal > 0

    for daily_state in daily_states:
        state = _astronaut_state[daily_state.profile.name]

        if had_harvest:
            # Only count triage on days when food was actually available.
            # Zero coverage on a non-harvest day is expected — crew eats from stores.
            # Triage fires when we had food but still couldn't adequately feed someone.
            if daily_state.kcal_coverage_pct < (TRIAGE_COVERAGE_THRESHOLD * 100):
                state["consecutive_low_coverage"] += 1
            else:
                state["consecutive_low_coverage"] = 0
        # On non-harvest days: counter stays unchanged — neither increment nor reset

        daily_state.consecutive_low_coverage_sols = state["consecutive_low_coverage"]

        if state["consecutive_low_coverage"] >= TRIAGE_CONSECUTIVE_SOLS:
            any_in_triage    = True
            triage_astronaut = daily_state.profile.name

    # ── Step 5: Compute crew-level aggregates ────────────────────────────────
    total_kcal_needed    = sum(a.kcal_needed_today for a in daily_states)
    total_protein_needed = sum(a.protein_needed_today for a in daily_states)
    total_water_needed   = sum(a.water_needed_today for a in daily_states)

    kcal_coverages    = [a.kcal_coverage_pct for a in daily_states]
    protein_coverages = [a.protein_coverage_pct for a in daily_states]
    health_scores     = [_health_score(a.health_status) for a in daily_states]

    avg_kcal_coverage    = round(sum(kcal_coverages)    / 4, 1)
    min_kcal_coverage    = round(min(kcal_coverages),        1)
    avg_protein_coverage = round(sum(protein_coverages) / 4, 1)
    min_protein_coverage = round(min(protein_coverages),     1)
    avg_health_score     = round(sum(health_scores)     / 4, 3)

    # Crew need variance — normalised std deviation of kcal needs
    # High variance = EVA + rest day happening simultaneously = agent needs to respond
    kcal_needs = [a.kcal_needed_today for a in daily_states]
    mean_need  = sum(kcal_needs) / 4
    variance   = sum((x - mean_need) ** 2 for x in kcal_needs) / 4
    std_dev    = math.sqrt(variance)
    crew_need_variance = round(min(1.0, std_dev / MAX_KCAL_PER_DAY), 4)

    # Critical crew health — 2+ crew simultaneously ill or injured
    non_nominal = sum(
        1 for a in daily_states
        if a.health_status in ("ill", "injured")
    )
    crew_critical = non_nominal >= CREW_CRITICAL_THRESHOLD

    # Mission cumulative stats
    total_evas          = sum(s["total_evas"]          for s in _astronaut_state.values())
    total_illness_days  = sum(s["total_illness_days"]  for s in _astronaut_state.values())
    total_injury_days   = sum(s["total_injury_days"]   for s in _astronaut_state.values())

    if crew_critical:
        logger.warning(
            "Sol %d: CREW CRITICAL — %d crew members ill/injured simultaneously.",
            day, non_nominal
        )

    if any_in_triage:
        logger.warning(
            "Sol %d: TRIAGE — %s below %.0f%% coverage for %d consecutive sols.",
            day, triage_astronaut,
            TRIAGE_COVERAGE_THRESHOLD * 100,
            TRIAGE_CONSECUTIVE_SOLS,
        )

    logger.info(
        "Sol %d crew | needs=%.0f kcal / %.0fg protein | "
        "avg_coverage=%.1f%% min_coverage=%.1f%% | health=%.2f | critical=%s",
        day, total_kcal_needed, total_protein_needed,
        avg_kcal_coverage, min_kcal_coverage,
        avg_health_score, crew_critical,
    )

    return CrewDailyState(
        astronauts             = daily_states,
        total_kcal_needed      = round(total_kcal_needed,    1),
        total_protein_needed   = round(total_protein_needed, 1),
        total_water_needed     = round(total_water_needed,   2),
        avg_kcal_coverage      = avg_kcal_coverage,
        min_kcal_coverage      = min_kcal_coverage,
        avg_protein_coverage   = avg_protein_coverage,
        min_protein_coverage   = min_protein_coverage,
        avg_health_score       = avg_health_score,
        crew_need_variance     = crew_need_variance,
        any_in_triage          = any_in_triage,
        triage_astronaut       = triage_astronaut,
        crew_critical          = crew_critical,
        medic_available        = medic_healthy,
        total_mission_evas         = total_evas,
        total_mission_illness_days = total_illness_days,
        total_mission_injury_days  = total_injury_days,
    )


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC: RESET
# Called when mission resets (main.py lifespan)
# ─────────────────────────────────────────────────────────────────────────────

def reset_crew() -> None:
    """
    Clear all mutable crew state. Called by main.py on mission reset.
    """
    global _astronaut_state
    _astronaut_state = {}
    logger.info("Crew state reset.")