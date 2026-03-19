export interface HealthResponse {
  status: 'ok'
  sol: number
  sols_remaining: number
  agent_trained: number
}

export interface Allocation {
  potato_pct: number
  legume_pct: number
  lettuce_pct: number
  radish_pct: number
  herb_pct: number
}

export interface EnvironmentData {
  day: number
  temp_celsius: number
  humidity_rh: number
  co2_ppm: number
  par_umol_m2s: number
  ph: number
  ec_ms_cm: number
  water_liters_available: number
  power_kwh_available: number
  growth_system: string
}

export interface NutritionData {
  harvested_kcal: number
  harvested_protein_g: number
  calorie_coverage_pct: number
  protein_coverage_pct: number
  total_yield_kg: number
  standing_crop_kcal: number
  is_harvest_day: boolean
  cumulative_kcal: number
  cumulative_protein_g: number
}

export interface ResourceData {
  water_available_liters: number
  water_consumed_liters: number
  water_recycled_liters: number
  water_extracted_liters: number
  recycling_ratio: number
  water_critical: boolean
  nutrient_n_ppm: number
  nutrient_k_ppm: number
  nutrient_fe_ppm: number
  nutrients_critical: boolean
  ph: number
  ec_ms_cm: number
  n_stock_remaining_pct: number
  k_stock_remaining_pct: number
  fe_stock_remaining_pct: number
  any_critical: boolean
}

export interface RewardData {
  total: number
  nutrition_score: number
  efficiency_score: number
  stress_score: number
  critical_score: number
  nutrition_contribution: number
  efficiency_contribution: number
  stress_contribution: number
  critical_contribution: number
  nutrition_note: string
  efficiency_note: string
  stress_note: string
  critical_note: string
}

export interface AgentData {
  sols_trained: number
  in_warmup: boolean
  learning_rate: number
  reward_received: number
  cumulative_reward: number
  recent_avg_reward?: number | null
  calorie_coverage: number
  protein_coverage: number
  water_reserve_frac: number
  avg_stress: number
  nutrient_stock_frac: number
  day_fraction: number
  raw_adjustments: number[]
  proposed_allocation: Allocation
}

export interface PlantingEvent {
  crop_type: string
  area_m2: number
  expected_harvest_day: number
  growth_system: string
  target_par: number
  target_temp: number
  target_co2_ppm: number
  target_ph: number
  notes: string
}

export interface StressAlert {
  crop_type: string
  stress_type: string
  severity: number
  recommended_action: string
  day_detected: number
}

export interface CropStatus {
  crop_type: string
  days_grown: number
  growth_rate_today: number
  cumulative_growth: number
  projected_yield_kg_m2: number
  is_stressed: boolean
  days_to_min_harvest: number
  ready_to_harvest: boolean
  stress_count: number
}

export interface Astronaut {
  name: string
  role: string
  age: number
  sex: string
  weight_kg: number
  kcal_needed_today: number
  protein_needed_today: number
  water_needed_today: number
  kcal_coverage_pct: number
  protein_coverage_pct: number
  health_status: string
  active_conditions: string[]
  consecutive_low_coverage_sols: number
  days_on_mission: number
  total_evas: number
  total_illness_days: number
  total_injury_days: number
}

export interface CrewData {
  astronauts: Astronaut[]
  total_kcal_needed: number
  total_protein_needed: number
  total_water_needed: number
  avg_kcal_coverage: number
  min_kcal_coverage: number
  avg_protein_coverage: number
  min_protein_coverage: number
  avg_health_score: number
  crew_need_variance: number
  any_in_triage: boolean
  triage_astronaut: string | null
  crew_critical: boolean
  medic_available: boolean
  total_mission_evas: number
  total_mission_illness_days: number
  total_mission_injury_days: number
}

export type RecommendationPriority = 'low' | 'medium' | 'high' | 'critical'

export type CrewRiskLevel = 'low' | 'medium' | 'high' | 'unknown'

export interface ClaudeNextStep {
  id: string
  action: string
  priority: RecommendationPriority
  rationale: string
}

export interface ClaudeRecommendation {
  generated_for_day: number
  status_summary: string
  next_steps: ClaudeNextStep[]
  warnings: string[]
  outlook: string
  crew_risk_level: CrewRiskLevel
  confidence: number | null
  is_fallback: boolean
}

export interface DailyResponse {
  day: number
  environment: EnvironmentData
  allocation: Allocation
  nutrition: NutritionData
  resources: ResourceData
  reward: RewardData
  agent: AgentData
  planting_events: PlantingEvent[]
  harvest_events: string[]
  stress_alerts: StressAlert[]
  crop_statuses: CropStatus[]
  crew: CrewData | null
  summary: string
  mission_day: number
  days_remaining: number
}

export interface MissionSummary {
  current_day: number
  days_remaining: number
  mission_duration: number
  total_kcal_produced: number
  total_protein_produced_g: number
  total_water_recycled_l: number
  total_yield_kg: number
  avg_daily_reward: number
  avg_calorie_coverage_pct: number
  avg_recycling_ratio_pct: number
  current_allocation: Allocation
  agent_sols_trained: number
  agent_cumulative_reward: number
  mission_status: 'nominal' | 'caution' | 'critical'
  total_crew_evas: number | null
  total_crew_illness_days: number | null
  total_crew_injury_days: number | null
  healthiest_astronaut: string | null
  most_at_risk_astronaut: string | null
}

export interface StepRequest {
  n_sols: number
  seed?: number
}

export interface TimelinePoint {
  day: number
  reward: number
  calorieCoveragePct: number
  proteinCoveragePct: number
  recyclingRatioPct: number
  waterAvailable: number
  anyCritical: boolean
}

export type StepSize = number
