import InfoTooltip from '@/components/dashboard/InfoTooltip'
import type { CrewData, MissionSummary, NutritionData } from '@/types/greenhouse'

interface CrewPanelProps {
  crew: CrewData | null
  missionSummary?: MissionSummary | null
  nutrition?: NutritionData | null
  day?: number
}

function healthTone(status: string) {
  switch (status) {
    case 'injured':
      return 'border-red-400/20 bg-red-500/10 text-red-100'
    case 'ill':
      return 'border-orange-400/20 bg-orange-500/10 text-orange-100'
    case 'high_stress':
      return 'border-amber-300/20 bg-amber-400/10 text-amber-100'
    case 'recovering':
      return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
    default:
      return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
  }
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ')
}

function conditionsLabel(conditions: string[]) {
  if (conditions.length === 0) return 'No active conditions'
  return conditions.map((condition) => condition.replace(/_/g, ' ')).join(', ')
}

function compactNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export default function CrewPanel({ crew, missionSummary, nutrition, day }: CrewPanelProps) {
  const isHarvestDay = nutrition?.is_harvest_day ?? false
  const harvestedKcal = nutrition?.harvested_kcal ?? 0

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.34)] md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(64,168,196,0.12),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_46%)]" />

      <div className="relative">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Crew</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
              Astronaut Health & Demand
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-white/58">
              Live per-astronaut condition tracking for all four crew members, including needs,
              conditions, EVA load, and current mission risk.
            </p>
          </div>

          <div
            className={`rounded-full border px-4 py-2 text-sm ${
              crew?.crew_critical
                ? 'border-red-400/20 bg-red-500/10 text-red-100'
                : crew?.any_in_triage
                  ? 'border-orange-400/20 bg-orange-500/10 text-orange-100'
                  : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
            }`}
          >
            {crew?.crew_critical
              ? 'Crew critical'
              : crew?.any_in_triage
                ? `Triage: ${crew.triage_astronaut ?? 'active'}`
                : 'Crew nominal'}
          </div>
        </div>

        {!crew ? (
          <div className="rounded-[20px] border border-white/8 bg-black/20 p-5 text-sm text-white/58">
            Crew telemetry is not available yet for this mission state.
          </div>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-4">
              <InfoTooltip content="Average crew health score across all astronauts for the selected sol.">
                <div className="rounded-[18px] border border-white/8 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">Avg Health</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                    {Math.round(crew.avg_health_score * 100)}%
                  </p>
                </div>
              </InfoTooltip>

              <InfoTooltip
                content={
                  isHarvestDay
                    ? 'Worst-fed astronaut fresh-harvest calorie coverage for the selected sol.'
                    : 'No fresh harvest was distributed on this sol. Crew intake is assumed to come from stored food reserves outside this per-sol harvest metric.'
                }
              >
                <div className="rounded-[18px] border border-white/8 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">
                    {isHarvestDay ? 'Min Fresh Coverage' : 'Food State'}
                  </p>
                  {isHarvestDay ? (
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                      {crew.min_kcal_coverage.toFixed(1)}%
                    </p>
                  ) : (
                    <p className="mt-3 text-lg font-semibold tracking-[-0.04em] text-white">
                      Stored-food day
                    </p>
                  )}
                  <p className="mt-2 text-sm leading-6 text-white/54">
                    {isHarvestDay
                      ? `${compactNumber(harvestedKcal)} kcal harvested today`
                      : `Sol ${day ?? '-'} has no fresh harvest event`}
                  </p>
                </div>
              </InfoTooltip>

              <InfoTooltip content="Crew-wide cumulative EVA count across the mission.">
                <div className="rounded-[18px] border border-white/8 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">Mission EVAs</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                    {crew.total_mission_evas}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/54">
                    {crew.total_mission_evas > 0 ? 'Operational EVA history logged' : 'No EVAs yet'}
                  </p>
                </div>
              </InfoTooltip>

              <InfoTooltip content="Backend mission summary picks the healthiest and most at-risk astronaut based on cumulative illness and injury burden.">
                <div className="rounded-[18px] border border-white/8 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">Risk Split</p>
                  <p className="mt-3 text-sm leading-6 text-white/76">
                    Best: {missionSummary?.healthiest_astronaut ?? 'Unknown'}
                    <br />
                    At Risk: {missionSummary?.most_at_risk_astronaut ?? 'Unknown'}
                  </p>
                </div>
              </InfoTooltip>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
              {crew.astronauts.map((astronaut) => (
                <div
                  key={astronaut.name}
                  className="rounded-[22px] border border-white/8 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                        {astronaut.role}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">
                        {astronaut.name}
                      </h3>
                      <p className="mt-1 text-sm text-white/45">
                        {astronaut.sex} · {astronaut.age}y · {astronaut.weight_kg.toFixed(1)} kg
                      </p>
                    </div>

                    <div
                      className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${healthTone(astronaut.health_status)}`}
                    >
                      {formatStatus(astronaut.health_status)}
                    </div>
                  </div>

                  <InfoTooltip content={conditionsLabel(astronaut.active_conditions)}>
                    <div className="mt-4 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white/68">
                      {conditionsLabel(astronaut.active_conditions)}
                    </div>
                  </InfoTooltip>

                  {isHarvestDay && (
                    <div className="mt-4 space-y-3">
                      <InfoTooltip content="Calories received from today’s harvest relative to this astronaut’s individual daily need.">
                        <div>
                          <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/38">
                            <span>Fresh Calorie Coverage</span>
                            <span>{astronaut.kcal_coverage_pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                            <div
                              className="h-full rounded-full bg-cyan-300"
                              style={{ width: `${Math.max(6, Math.min(100, astronaut.kcal_coverage_pct))}%` }}
                            />
                          </div>
                        </div>
                      </InfoTooltip>

                      <InfoTooltip content="Protein received from today’s harvest relative to this astronaut’s individual daily need.">
                        <div>
                          <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/38">
                            <span>Fresh Protein Coverage</span>
                            <span>{astronaut.protein_coverage_pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                            <div
                              className="h-full rounded-full bg-emerald-300"
                              style={{ width: `${Math.max(6, Math.min(100, astronaut.protein_coverage_pct))}%` }}
                            />
                          </div>
                        </div>
                      </InfoTooltip>
                    </div>
                  )}

                  <div className="mt-4 grid gap-2 text-sm text-white/72">
                    <InfoTooltip content="Live nutritional and hydration demand for this astronaut on the selected sol.">
                      <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
                        Need: {compactNumber(astronaut.kcal_needed_today)} kcal /{' '}
                        {compactNumber(astronaut.protein_needed_today, 1)} g /{' '}
                        {compactNumber(astronaut.water_needed_today, 2)} L
                      </div>
                    </InfoTooltip>

                    <InfoTooltip content="Triage pressure rises when an astronaut remains below the low-coverage threshold across multiple harvest sols.">
                      <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
                        Low-coverage streak: {astronaut.consecutive_low_coverage_sols} sols
                      </div>
                    </InfoTooltip>

                    <InfoTooltip content="Cumulative operational burden and medical events for this astronaut across the mission.">
                      <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
                        {astronaut.total_evas === 0 &&
                        astronaut.total_illness_days === 0 &&
                        astronaut.total_injury_days === 0
                          ? 'No EVA or medical incidents logged yet'
                          : `EVAs ${astronaut.total_evas} · Ill ${astronaut.total_illness_days} · Inj ${astronaut.total_injury_days}`}
                      </div>
                    </InfoTooltip>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
