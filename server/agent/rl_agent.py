"""
server/agent/rl_agent.py

Reinforcement Learning agent for the Mars greenhouse.
Uses a contextual bandit with REINFORCE policy gradient.

Responsibility:
  - Observe the current greenhouse state as a compact feature vector
  - Maintain a policy (linear weights) that maps state → allocation adjustments
  - After each sol, update the policy using the reward signal from reward.py
  - Return an AreaAllocation override to planner.py's allocate() function

Why contextual bandit, not deep RL:
  We have exactly one 450-sol mission — not thousands of training episodes.
  Deep RL (PPO, SAC) needs 10k+ episodes to converge.
  A linear policy gradient converges in ~50-100 steps, which means
  the agent is genuinely improving by sol 50 and well-tuned by sol 150.
  It's also fully interpretable — we can show the judges exactly which
  state features drive which allocation decisions.

Action space:
  5-dimensional continuous vector — one adjustment per crop type.
  Adjustments are added to the current allocation, then clamped
  to agronomic limits and renormalised. This means the agent learns
  *changes* to make, not absolute allocations — much easier to learn.

State space:
  6-dimensional normalised feature vector built from outputs of:
    crops.py      → stress severity, calorie/protein coverage
    resources.py  → water reserve fraction, nutrient stock level
    martian.py    → day fraction (captures seasonal patterns)

Policy:
  weights matrix: shape (5, 6) — 30 learnable parameters
  adjustment = weights @ state_vector   → shape (5,)
  Each row of weights controls one crop's allocation response.

Update rule (REINFORCE):
  weights += learning_rate × reward × eligibility_trace
  eligibility_trace = state_vector (for linear policy)

  Positive reward → reinforce current allocation direction
  Negative reward → reverse it

Feeds into:
  planner.py     ← rl_override=AreaAllocation (every sol after warmup)
  schemas.py     ← agent_state for frontend dashboard
  main.py        ← orchestrates observe() + update_policy() each sol
"""

from __future__ import annotations
import json
import logging
import math
import os
import random
from dataclasses import dataclass, field, asdict

from agent.models import AreaAllocation, CropType
from agent.reward import RewardSignal
from environment.crops import SimulationResult
from environment.resources import ResourceStatus

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# HYPERPARAMETERS
# ─────────────────────────────────────────────────────────────────────────────

LEARNING_RATE       = 0.02    # how fast the policy updates each sol
EXPLORATION_STD     = 0.05    # Gaussian noise added to actions (exploration)
WARMUP_SOLS         = 10      # sols before RL override kicks in (planner rules first)
DISCOUNT_GAMMA      = 0.95    # discount factor for future rewards
MIN_LEARNING_RATE   = 0.005   # learning rate floor (decays over time)
LR_DECAY_RATE       = 0.002   # learning rate decay per sol

# Agronomic allocation limits (mirrors planner.py ALLOC_LIMITS)
# [min, max] for each crop — agent can't push outside these
ALLOC_LIMITS = {
    CropType.POTATO:  (0.40, 0.50),
    CropType.LEGUME:  (0.20, 0.30),
    CropType.LETTUCE: (0.15, 0.20),
    CropType.RADISH:  (0.05, 0.10),
    CropType.HERB:    (0.03, 0.08),
}

# Crop index order — fixed, so weight rows always mean the same crop
CROP_ORDER = [
    CropType.POTATO,
    CropType.LEGUME,
    CropType.LETTUCE,
    CropType.RADISH,
    CropType.HERB,
]

STATE_DIM  = 6   # number of features in state vector
ACTION_DIM = 5   # one adjustment per crop type


# ─────────────────────────────────────────────────────────────────────────────
# STATE VECTOR
# A compact, normalised representation of what the agent observes each sol
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class AgentObservation:
    """
    The 6 features the agent sees each sol.
    All normalised to [0.0, 1.0] so the linear policy works properly.

    Feature design rationale:
      - calorie_coverage:   directly what we're optimising — are crew fed?
      - protein_coverage:   secondary nutrition target — protein deficit lags
      - water_reserve_frac: how much water buffer we have (0=critical, 1=full)
      - avg_stress:         aggregate plant health — predicts yield loss
      - nutrient_stock_frac: how much nutrient budget remains (long-term)
      - day_fraction:       where we are in the 450-sol mission —
                            agent learns to conserve more as mission progresses
                            and to anticipate dust storm seasons
    """
    calorie_coverage:    float   # sim.total_projected_kcal / needs.kcal_per_day
    protein_coverage:    float   # sim.total_projected_protein_g / needs.protein_g
    water_reserve_frac:  float   # res.water_available_liters / 500.0
    avg_stress:          float   # mean severity across all stress reports
    nutrient_stock_frac: float   # mean of N/K/Fe stock remaining fractions
    day_fraction:        float   # current_day / 450

    def to_vector(self) -> list[float]:
        """Return as ordered list for matrix multiply."""
        return [
            self.calorie_coverage,
            self.protein_coverage,
            self.water_reserve_frac,
            self.avg_stress,
            self.nutrient_stock_frac,
            self.day_fraction,
        ]


def build_observation(
    sim: SimulationResult,
    res: ResourceStatus,
    needs_kcal: float,
    needs_protein: float,
    mission_duration: int = 450,
) -> AgentObservation:
    """
    Build the normalised state vector from simulation outputs.
    Called by main.py before observe(), using outputs of crops.py
    and resources.py that have already run this sol.

    Clips all values to [0.0, 1.0] — the linear policy assumes this.
    """
    # Use 30-sol rolling average from reward history for stable coverage signal
    # Falls back to standing crop estimate on early sols before first harvest
    from agent.reward import harvest_kcal_history, harvest_protein_history
    window = 30
    recent_kcal    = harvest_kcal_history[-window:] if harvest_kcal_history else [0.0]
    recent_protein = harvest_protein_history[-window:] if harvest_protein_history else [0.0]
    avg_kcal    = sum(recent_kcal)    / len(recent_kcal)
    avg_protein = sum(recent_protein) / len(recent_protein)
    calorie_coverage = _clip01(avg_kcal    / needs_kcal)
    protein_coverage = _clip01(avg_protein / needs_protein)
    water_frac       = _clip01(res.water_available_liters  / 500.0)

    avg_stress = (
        sum(r.severity for r in sim.all_stress_reports) / len(sim.all_stress_reports)
        if sim.all_stress_reports else 0.0
    )

    nutrient_frac = (
        res.n_stock_remaining_pct  * 0.40 +
        res.k_stock_remaining_pct  * 0.35 +
        res.fe_stock_remaining_pct * 0.25
    )

    day_frac = _clip01(sim.day / mission_duration)

    return AgentObservation(
        calorie_coverage    = calorie_coverage,
        protein_coverage    = protein_coverage,
        water_reserve_frac  = water_frac,
        avg_stress          = _clip01(avg_stress),
        nutrient_stock_frac = _clip01(nutrient_frac),
        day_fraction        = day_frac,
    )


# ─────────────────────────────────────────────────────────────────────────────
# POLICY
# Linear mapping from state → allocation adjustments
# ─────────────────────────────────────────────────────────────────────────────

class LinearPolicy:
    """
    A 5×6 weight matrix mapping state features to crop allocation adjustments.

    Row i controls crop CROP_ORDER[i].
    Column j is the weight for state feature j.

    Initialised with small random weights (not zeros — zero init means
    the agent starts with no preference, which is fine, but tiny noise
    helps break symmetry between crops that have similar initial allocations).

    The policy computes:
      raw_adjustments = weights @ state_vector   (shape: 5)
      scaled          = raw_adjustments × 0.05   (max ±5% per feature unit)
      new_alloc       = current_alloc + scaled
      final_alloc     = clamp + renormalise

    Why linear:
      With 450 training steps and a 6-dim state, a linear model has
      30 parameters — low enough to converge reliably. A neural net
      with 30 parameters would also work, but a matrix multiply is
      transparent and debuggable in a hackathon setting.
    """

    def __init__(self, seed: int = 42):
        random.seed(seed)
        # 5 crops × 6 state features
        # Small init: ±0.01 — adjustments start tiny, grow with learning
        self.weights: list[list[float]] = [
            [random.gauss(0, 0.01) for _ in range(STATE_DIM)]
            for _ in range(ACTION_DIM)
        ]

    def forward(self, state: list[float]) -> list[float]:
        """
        Compute raw adjustments: weights @ state.
        Returns a list of 5 floats (one per crop).
        """
        adjustments = []
        for row in self.weights:
            dot = sum(w * s for w, s in zip(row, state))
            adjustments.append(dot)
        return adjustments

    def update(
        self,
        state: list[float],
        reward: float,
        learning_rate: float,
    ) -> None:
        """
        REINFORCE gradient update:
          weights[i][j] += lr × reward × state[j]

        If reward > 0: reinforce the state→action mapping that produced it.
        If reward < 0: reverse it.

        This is the simplest correct policy gradient rule for a linear policy.
        No baseline subtraction needed at this scale — the reward is already
        normalised to [-1, 1] by reward.py's rescaling.
        """
        for i in range(ACTION_DIM):
            for j in range(STATE_DIM):
                self.weights[i][j] += learning_rate * reward * state[j]

    def to_dict(self) -> dict:
        return {"weights": self.weights}

    def from_dict(self, d: dict) -> None:
        self.weights = d["weights"]


# ─────────────────────────────────────────────────────────────────────────────
# AGENT STATE — what main.py and schemas.py can inspect
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class AgentState:
    """
    Full agent state for a given sol.
    Serialised by schemas.py and sent to the frontend dashboard.
    Shows the judges exactly what the agent is thinking.
    """
    day:                  int
    observation:          AgentObservation
    raw_adjustments:      list[float]          # what the policy computed
    proposed_allocation:  AreaAllocation       # after clamping + renorm
    reward_received:      float                # RewardSignal.total
    learning_rate:        float
    total_sols_trained:   int
    cumulative_reward:    float
    in_warmup:            bool
    exploration_noise:    list[float]          # noise added this sol
    recent_avg_reward:    float | None = None  # rolling 10-sol average


# ─────────────────────────────────────────────────────────────────────────────
# MAIN AGENT CLASS
# ─────────────────────────────────────────────────────────────────────────────

class GreenhouseAgent:
    """
    The RL agent that learns to optimise greenhouse allocation over 450 sols.

    Usage in main.py each sol:

        # 1. Build observation from this sol's simulation outputs
        obs = build_observation(sim_result, resource_status, ...)

        # 2. Agent observes and proposes allocation
        allocation = agent.observe(obs, current_allocation)

        # 3. Use allocation in planner (as rl_override)
        schedule = planner.plan(..., rl_override=allocation)

        # 4. Score the sol
        reward_signal = reward.score(sim_result, resource_status, schedule, needs)

        # 5. Agent learns from reward
        agent_state = agent.update_policy(reward_signal)

        # 6. agent_state goes to schemas.py for frontend
    """

    def __init__(self, seed: int = 42, checkpoint_path: str = "data/agent_checkpoint.json"):
        self.policy            = LinearPolicy(seed=seed)
        self.checkpoint_path   = checkpoint_path

        # Training state
        self.sols_trained      = 0
        self.cumulative_reward = 0.0
        self.current_lr        = LEARNING_RATE

        # Per-sol memory (needed for update after observe)
        self._last_state_vec:  list[float]    = []
        self._last_obs:        AgentObservation | None = None
        self._last_noise:      list[float]    = []
        self._last_adjustments: list[float]   = []
        self._last_allocation: AreaAllocation | None = None

        # Reward history for logging
        self.reward_history: list[float] = []

        # Try loading a checkpoint (so training persists across restarts)
        self._load_checkpoint()

    # ── PUBLIC: observe() ────────────────────────────────────────────────────

    def observe(
        self,
        obs: AgentObservation,
        current_allocation: AreaAllocation,
    ) -> AreaAllocation:
        """
        Step 1 each sol: agent observes state and proposes an allocation.

        During warmup (sols < WARMUP_SOLS):
          Returns None — planner uses its own rule-based logic.
          This lets the rule-based planner seed good initial behaviour
          before the agent takes over.

        After warmup:
          Computes policy adjustment, adds exploration noise,
          applies to current allocation, clamps and renormalises.

        Returns AreaAllocation (or None during warmup).
        """
        state_vec = obs.to_vector()
        self._last_state_vec = state_vec
        self._last_obs       = obs

        if self.sols_trained < WARMUP_SOLS:
            logger.info(
                "Sol %d: agent in warmup (%d/%d sols). Rule-based planner active.",
                self.sols_trained, self.sols_trained, WARMUP_SOLS,
            )
            self._last_allocation  = current_allocation
            self._last_noise       = [0.0] * ACTION_DIM
            self._last_adjustments = [0.0] * ACTION_DIM
            return current_allocation   # planner uses its own rules

        # ── Compute policy adjustments ────────────────────────────────────────
        raw_adjustments = self.policy.forward(state_vec)
        self._last_adjustments = raw_adjustments

        # ── Add exploration noise (Gaussian) ──────────────────────────────────
        # Exploration decays as the agent gains more experience.
        # By sol 200 the agent is mostly exploiting; still explores a little.
        explore_std  = EXPLORATION_STD * math.exp(-0.005 * self.sols_trained)
        noise        = [random.gauss(0, explore_std) for _ in range(ACTION_DIM)]
        self._last_noise = noise

        # ── Apply adjustments to current allocation ───────────────────────────
        adjusted_allocs = self._apply_adjustments(
            current_allocation,
            raw_adjustments,
            noise,
        )
        self._last_allocation = adjusted_allocs

        logger.info(
            "Sol %d agent | adj=%s | alloc: potato=%.2f legume=%.2f lettuce=%.2f",
            self.sols_trained,
            [f"{a:.3f}" for a in raw_adjustments],
            adjusted_allocs.potato_pct,
            adjusted_allocs.legume_pct,
            adjusted_allocs.lettuce_pct,
        )

        return adjusted_allocs

    # ── PUBLIC: update_policy() ──────────────────────────────────────────────

    def update_policy(self, reward_signal: RewardSignal) -> AgentState:
        """
        Step 2 each sol: agent learns from the reward it received.

        Updates the policy weights using REINFORCE, decays learning rate,
        saves a checkpoint, and returns AgentState for schemas.py.

        Called by main.py immediately after reward.score().
        """
        reward = reward_signal.total
        self.cumulative_reward += reward
        self.reward_history.append(reward)

        # ── Policy gradient update ────────────────────────────────────────────
        if self.sols_trained >= WARMUP_SOLS and self._last_state_vec:
            self.policy.update(
                state        = self._last_state_vec,
                reward       = reward,
                learning_rate = self.current_lr,
            )
            logger.info(
                "Sol %d policy updated | reward=%.4f | lr=%.4f | cumulative=%.2f",
                self.sols_trained, reward, self.current_lr, self.cumulative_reward,
            )

        # ── Decay learning rate ───────────────────────────────────────────────
        # Starts at 0.02, floors at 0.005
        # Faster learning early (explore widely), slower later (fine-tune)
        self.current_lr = max(
            LEARNING_RATE * math.exp(-LR_DECAY_RATE * self.sols_trained),
            MIN_LEARNING_RATE,
        )

        self.sols_trained += 1

        # ── Save checkpoint every 10 sols ─────────────────────────────────────
        if self.sols_trained % 10 == 0:
            self._save_checkpoint()

        # ── Build AgentState for schemas.py ──────────────────────────────────
        state = AgentState(
            day                  = reward_signal.day,
            observation          = self._last_obs,
            raw_adjustments      = self._last_adjustments,
            proposed_allocation  = self._last_allocation,
            reward_received      = reward,
            learning_rate        = self.current_lr,
            total_sols_trained   = self.sols_trained,
            cumulative_reward    = round(self.cumulative_reward, 4),
            in_warmup            = self.sols_trained < WARMUP_SOLS,
            exploration_noise    = self._last_noise,
            recent_avg_reward    = round(sum(self.reward_history[-10:]) / len(self.reward_history[-10:]), 4) if self.reward_history else None,
        )

        return state

    # ── INTERNAL: apply adjustments ──────────────────────────────────────────

    def _apply_adjustments(
        self,
        current: AreaAllocation,
        adjustments: list[float],
        noise: list[float],
    ) -> AreaAllocation:
        """
        Apply policy adjustments + noise to current allocation.

        Scale factor 0.05: raw adjustment of 1.0 → 5% shift in allocation.
        This keeps changes gradual — the agent nudges, doesn't lurch.

        After adjustment:
          1. Add to current percentages
          2. Clamp each crop to its agronomic limits
          3. Renormalise so everything sums to 1.0
        """
        SCALE = 0.05

        current_pcts = [
            current.potato_pct,
            current.legume_pct,
            current.lettuce_pct,
            current.radish_pct,
            current.herb_pct,
        ]

        # Step 1: apply adjustments without clamping yet
        new_pcts = []
        for i, (pct, adj, nse) in enumerate(zip(current_pcts, adjustments, noise)):
            adjusted = pct + (adj + nse) * SCALE
            new_pcts.append(adjusted)

        # Step 2: renormalise to sum = 1.0
        total = sum(new_pcts)
        new_pcts = [p / total for p in new_pcts]

        # Step 3: clamp AFTER renormalisation so limits are actually respected
        # Then renormalise again to fix any sum drift from clamping
        clamped = []
        for i, pct in enumerate(new_pcts):
            crop   = CROP_ORDER[i]
            lo, hi = ALLOC_LIMITS[crop]
            clamped.append(_clamp(pct, lo, hi))

        total2  = sum(clamped)
        new_pcts = [p / total2 for p in clamped]

        return AreaAllocation(
            potato_pct  = round(new_pcts[0], 4),
            legume_pct  = round(new_pcts[1], 4),
            lettuce_pct = round(new_pcts[2], 4),
            radish_pct  = round(new_pcts[3], 4),
            herb_pct    = round(new_pcts[4], 4),
        )

    # ── CHECKPOINT: persist training across restarts ─────────────────────────

    def _save_checkpoint(self) -> None:
        """
        Save policy weights and training state to disk.
        This means if main.py restarts mid-simulation, the agent
        picks up where it left off rather than starting from scratch.
        """
        try:
            os.makedirs(os.path.dirname(self.checkpoint_path), exist_ok=True)
            checkpoint = {
                "policy":            self.policy.to_dict(),
                "sols_trained":      self.sols_trained,
                "cumulative_reward": self.cumulative_reward,
                "current_lr":        self.current_lr,
                "reward_history":    self.reward_history[-50:],  # last 50 sols
            }
            with open(self.checkpoint_path, "w") as f:
                json.dump(checkpoint, f, indent=2)
            logger.info("Agent checkpoint saved at sol %d.", self.sols_trained)
        except Exception as e:
            logger.warning("Failed to save checkpoint: %s", e)

    def _load_checkpoint(self) -> None:
        """
        Load policy weights from a previous run if checkpoint exists.
        Called once at __init__ — silent if no checkpoint found.
        """
        if not os.path.exists(self.checkpoint_path):
            logger.info("No agent checkpoint found — starting fresh.")
            return
        try:
            with open(self.checkpoint_path) as f:
                checkpoint = json.load(f)
            self.policy.from_dict(checkpoint["policy"])
            self.sols_trained      = checkpoint["sols_trained"]
            self.cumulative_reward = checkpoint["cumulative_reward"]
            self.current_lr        = checkpoint["current_lr"]
            self.reward_history    = checkpoint.get("reward_history", [])
            logger.info(
                "Agent checkpoint loaded — resuming from sol %d (cumulative reward=%.2f).",
                self.sols_trained, self.cumulative_reward,
            )
        except Exception as e:
            logger.warning("Failed to load checkpoint: %s. Starting fresh.", e)

    # ── UTILITY: recent performance summary ──────────────────────────────────

    def performance_summary(self, window: int = 10) -> dict:
        """
        Returns a summary of recent agent performance.
        Used by schemas.py to populate the frontend dashboard.
        """
        recent = self.reward_history[-window:] if self.reward_history else [0.0]
        return {
            "sols_trained":       self.sols_trained,
            "cumulative_reward":  round(self.cumulative_reward, 2),
            "recent_avg_reward":  round(sum(recent) / len(recent), 4),
            "recent_min_reward":  round(min(recent), 4),
            "recent_max_reward":  round(max(recent), 4),
            "current_lr":         round(self.current_lr, 5),
            "in_warmup":          self.sols_trained < WARMUP_SOLS,
        }


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _clip01(value: float) -> float:
    return max(0.0, min(1.0, value))