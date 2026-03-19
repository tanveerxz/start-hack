import type { ResourceData } from '@/types/greenhouse'

interface ResourcesPanelProps {
  resources: ResourceData | null
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
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className={`h-full rounded-full ${toneClass}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export default function ResourcesPanel({ resources }: ResourcesPanelProps) {
  const anyCritical = resources?.any_critical ?? false

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
            Resources
          </p>
          <h2 className="mt-2 text-xl font-semibold">Closed-Loop Status</h2>
        </div>

        <div
          className={`rounded-full border px-3 py-1 text-xs ${
            anyCritical
              ? 'border-red-400/20 bg-red-500/10 text-red-100'
              : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
          }`}
        >
          {anyCritical ? 'Critical Flags Active' : 'Nominal'}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">
            Water Available
          </p>
          <p className="mt-2 text-lg font-medium">
            {resources ? `${resources.water_available_liters.toFixed(1)} L` : '—'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">
            Water Consumed
          </p>
          <p className="mt-2 text-lg font-medium">
            {resources ? `${resources.water_consumed_liters.toFixed(1)} L` : '—'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">
            Water Recycled
          </p>
          <p className="mt-2 text-lg font-medium">
            {resources ? `${resources.water_recycled_liters.toFixed(1)} L` : '—'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">
            Water Extracted
          </p>
          <p className="mt-2 text-lg font-medium">
            {resources ? `${resources.water_extracted_liters.toFixed(1)} L` : '—'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">
            Recycling Ratio
          </p>
          <p className="mt-2 text-lg font-medium">
            {resources ? `${resources.recycling_ratio.toFixed(1)}%` : '—'}
          </p>
          <ProgressBar value={resources?.recycling_ratio ?? 0} />
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">
            Nutrient Status
          </p>
          <div className="mt-3 space-y-3 text-sm text-white/75">
            <div>
              <div className="flex items-center justify-between">
                <span>N stock</span>
                <span>{resources ? `${resources.n_stock_remaining_pct.toFixed(1)}%` : '—'}</span>
              </div>
              <ProgressBar
                value={resources?.n_stock_remaining_pct ?? 0}
                tone={(resources?.n_stock_remaining_pct ?? 100) < 25 ? 'red' : 'cyan'}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span>K stock</span>
                <span>{resources ? `${resources.k_stock_remaining_pct.toFixed(1)}%` : '—'}</span>
              </div>
              <ProgressBar
                value={resources?.k_stock_remaining_pct ?? 0}
                tone={(resources?.k_stock_remaining_pct ?? 100) < 25 ? 'red' : 'cyan'}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span>Fe stock</span>
                <span>{resources ? `${resources.fe_stock_remaining_pct.toFixed(1)}%` : '—'}</span>
              </div>
              <ProgressBar
                value={resources?.fe_stock_remaining_pct ?? 0}
                tone={(resources?.fe_stock_remaining_pct ?? 100) < 25 ? 'red' : 'cyan'}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}