import type { ResourceData } from '@/types/greenhouse'
import InfoTooltip from '@/components/dashboard/InfoTooltip'

interface ResourcesPanelProps {
  resources: ResourceData | null
  compact?: boolean
}

function ProgressBar({
  value,
  tone = 'cyan',
}: {
  value: number
  tone?: 'cyan' | 'orange' | 'red'
}) {
  const clamped = Math.max(0, Math.min(100, value))
  const toneClass =
    tone === 'red'
      ? 'bg-red-300'
      : tone === 'orange'
        ? 'bg-orange-300'
        : 'bg-cyan-300'

  return (
    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className={`h-full rounded-full ${toneClass} shadow-[0_0_18px_rgba(255,255,255,0.12)]`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  tooltip,
}: {
  label: string
  value: string
  sub: string
  tooltip: string
}) {
  return (
    <InfoTooltip content={tooltip}>
      <div className="rounded-[18px] border border-white/8 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
          {label}
        </p>
        <p className="mt-3 break-words text-[26px] font-semibold leading-none tracking-[-0.04em] text-white md:text-[30px]">
          {value}
        </p>
        <p className="mt-3 text-sm leading-6 text-white/46">{sub}</p>
      </div>
    </InfoTooltip>
  )
}

export default function ResourcesPanel({
  resources,
  compact = false,
}: ResourcesPanelProps) {
  const anyCritical = resources?.any_critical ?? false
  const nutrientTone = resources?.nutrients_critical ? 'orange' : 'cyan'

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.34)] md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(196,106,45,0.08),transparent_24%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_44%)]" />

      <div className="relative">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">
              Resources
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
              Closed-Loop Resource Model
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-white/58">
              Water reserves, recycling efficiency, and nutrient stock visibility.
            </p>
          </div>

          <div
            className={`rounded-full border px-4 py-2 text-sm ${
              anyCritical
                ? 'border-red-400/20 bg-red-500/10 text-red-100'
                : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
            }`}
          >
            {anyCritical ? 'Critical state detected' : 'Resource state nominal'}
          </div>
        </div>

        <div className={`grid gap-4 ${compact ? 'xl:grid-cols-1' : 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]'}`}>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ['Water Available', resources ? `${resources.water_available_liters.toFixed(1)} L` : '-', 'Immediate reserve', 'Water currently available in the loop after consumption and replenishment.'],
              ['Water Consumed', resources ? `${resources.water_consumed_liters.toFixed(1)} L` : '-', 'This sol usage', 'Total water used by the greenhouse during the current sol.'],
              ['Water Recycled', resources ? `${resources.water_recycled_liters.toFixed(1)} L` : '-', 'Recovered flow', 'Water captured and returned into the system through recycling.'],
              ['Water Extracted', resources ? `${resources.water_extracted_liters.toFixed(1)} L` : '-', 'External supplementation', 'Additional water pulled from outside the closed loop when reserves and recycling are not enough.'],
            ].map(([label, value, sub, tooltip]) => (
              <MetricCard key={label} label={label} value={value} sub={sub} tooltip={tooltip} />
            ))}
          </div>

          <div className="grid gap-3">
            <InfoTooltip content="Recycled water divided by consumed water for this sol. This is a headline closed-loop efficiency metric for mission sustainability.">
              <div className="rounded-[18px] border border-white/8 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                    Recycling Ratio
                  </p>
                  <p className="text-base font-semibold text-white md:text-lg">
                    {resources ? `${resources.recycling_ratio.toFixed(1)}%` : '-'}
                  </p>
                </div>

                <ProgressBar
                  value={resources?.recycling_ratio ?? 0}
                  tone={resources?.water_critical ? 'red' : 'cyan'}
                />

                <div className="mt-4 grid gap-3 text-sm text-white/60 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2">
                    Water critical: {resources?.water_critical ? 'Yes' : 'No'}
                  </div>
                  <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2">
                    Nutrients critical: {resources?.nutrients_critical ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            </InfoTooltip>

            <InfoTooltip content="Mission stock remaining for the primary nutrient reserves. Falling bars indicate long-run depletion pressure on the closed-loop resource plan.">
              <div className="rounded-[18px] border border-white/8 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                    Stock Remaining
                  </p>
                  <p className="text-sm text-white/50">N / K / Fe</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm text-white/72">
                      <span>N stock</span>
                      <span>{resources ? `${resources.n_stock_remaining_pct.toFixed(1)}%` : '-'}</span>
                    </div>
                    <ProgressBar
                      value={resources?.n_stock_remaining_pct ?? 0}
                      tone={(resources?.n_stock_remaining_pct ?? 100) < 25 ? 'red' : nutrientTone}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm text-white/72">
                      <span>K stock</span>
                      <span>{resources ? `${resources.k_stock_remaining_pct.toFixed(1)}%` : '-'}</span>
                    </div>
                    <ProgressBar
                      value={resources?.k_stock_remaining_pct ?? 0}
                      tone={(resources?.k_stock_remaining_pct ?? 100) < 25 ? 'red' : nutrientTone}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm text-white/72">
                      <span>Fe stock</span>
                      <span>{resources ? `${resources.fe_stock_remaining_pct.toFixed(1)}%` : '-'}</span>
                    </div>
                    <ProgressBar
                      value={resources?.fe_stock_remaining_pct ?? 0}
                      tone={(resources?.fe_stock_remaining_pct ?? 100) < 25 ? 'red' : nutrientTone}
                    />
                  </div>
                </div>
              </div>
            </InfoTooltip>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoTooltip content="Instantaneous nitrogen concentration in the nutrient solution.">
                <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                    N ppm
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {resources ? resources.nutrient_n_ppm.toFixed(1) : '-'}
                  </p>
                </div>
              </InfoTooltip>
              <InfoTooltip content="Instantaneous potassium concentration in the nutrient solution.">
                <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                    K ppm
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {resources ? resources.nutrient_k_ppm.toFixed(1) : '-'}
                  </p>
                </div>
              </InfoTooltip>
              <InfoTooltip content="Instantaneous iron concentration in the nutrient solution.">
                <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                    Fe ppm
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {resources ? resources.nutrient_fe_ppm.toFixed(1) : '-'}
                  </p>
                </div>
              </InfoTooltip>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
