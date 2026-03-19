import type { DailyResponse } from '@/types/greenhouse'

interface KpiGridProps {
  sol: DailyResponse | null
}

function kpi(label: string, value: string, tone?: string) {
  return { label, value, tone }
}

export default function KpiGrid({ sol }: KpiGridProps) {
  const activeStressCount =
    sol?.stress_alerts.length ?? 0

  const readyToHarvest =
    sol?.crop_statuses.filter((crop) => crop.ready_to_harvest).length ?? 0

  const items = [
    kpi('Reward', sol ? sol.reward.total.toFixed(3) : '—'),
    kpi(
      'Calorie Coverage',
      sol ? `${sol.nutrition.calorie_coverage_pct.toFixed(1)}%` : '—',
    ),
    kpi(
      'Protein Coverage',
      sol ? `${sol.nutrition.protein_coverage_pct.toFixed(1)}%` : '—',
    ),
    kpi(
      'Recycling Ratio',
      sol ? `${sol.resources.recycling_ratio.toFixed(1)}%` : '—',
    ),
    kpi(
      'Total Yield',
      sol ? `${sol.nutrition.total_yield_kg.toFixed(2)} kg` : '—',
    ),
    kpi('Stress Alerts', `${activeStressCount}`, activeStressCount > 0 ? 'warn' : 'ok'),
    kpi('Harvest Ready', `${readyToHarvest}`),
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl"
        >
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
            {item.label}
          </p>
          <p
            className={`mt-3 text-2xl font-semibold tracking-tight ${
              item.tone === 'warn'
                ? 'text-orange-200'
                : item.tone === 'ok'
                  ? 'text-cyan-100'
                  : 'text-white'
            }`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </section>
  )
}