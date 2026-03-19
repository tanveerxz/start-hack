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
  projected_kcal: number
  projected_protein_g: number
  calorie_coverage_pct: number
  protein_coverage_pct: number
  total_yield_kg: number
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

export type StepSize = 1 | 10 | 50