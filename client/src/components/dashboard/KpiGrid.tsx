import type { DailyResponse } from '@/types/greenhouse'

interface KpiGridProps {
  sol: DailyResponse | null
}

interface KpiItem {
  label: string
  value: string
  sub: string
  tone?: 'default' | 'cyan' | 'orange'
  progress: number
}

function toneClasses(tone: KpiItem['tone']) {
  switch (tone) {
    case 'cyan':
      return 'border-cyan-400/15 bg-cyan-500/[0.06]'
    case 'orange':
      return 'border-orange-400/15 bg-orange-500/[0.06]'
    default:
      return 'border-white/10 bg-white/[0.04]'
  }
}

function progressTone(tone: KpiItem['tone']) {
  switch (tone) {
    case 'cyan':
      return 'bg-cyan-300'
    case 'orange':
      return 'bg-orange-300'
    default:
      return 'bg-white/35'
  }
}

export default function KpiGrid({ sol }: KpiGridProps) {
  const activeStressCount = sol?.stress_alerts.length ?? 0
  const readyToHarvest =
    sol?.crop_statuses.filter((crop) => crop.ready_to_harvest).length ?? 0

  const items: KpiItem[] = [
    {
      label: 'Reward',
      value: sol ? sol.reward.total.toFixed(3) : '—',
      tone: 'cyan',
      sub: 'Current sol score',
      progress: sol ? Math.max(8, Math.min(100, 50 + sol.reward.total * 20)) : 0,
    },
    {
      label: 'Calorie Coverage',
      value: sol ? `${sol.nutrition.calorie_coverage_pct.toFixed(1)}%` : '—',
      sub: 'Projected nutritional coverage',
      progress: sol?.nutrition.calorie_coverage_pct ?? 0,
    },
    {
      label: 'Protein Coverage',
      value: sol ? `${sol.nutrition.protein_coverage_pct.toFixed(1)}%` : '—',
      sub: 'Crew protein sufficiency',
      progress: sol?.nutrition.protein_coverage_pct ?? 0,
    },
    {
      label: 'Recycling Ratio',
      value: sol ? `${sol.resources.recycling_ratio.toFixed(1)}%` : '—',
      sub: 'Closed-loop water efficiency',
      progress: sol?.resources.recycling_ratio ?? 0,
    },
    {
      label: 'Total Yield',
      value: sol ? `${sol.nutrition.total_yield_kg.toFixed(2)} kg` : '—',
      sub: 'Projected harvest mass',
      progress: sol ? Math.max(10, Math.min(100, sol.nutrition.total_yield_kg / 5)) : 0,
    },
    {
      label: 'Stress Alerts',
      value: `${activeStressCount}`,
      tone: activeStressCount > 0 ? 'orange' : 'default',
      sub: 'Active crop/system issues',
      progress: Math.min(100, activeStressCount * 10),
    },
    {
      label: 'Harvest Ready',
      value: `${readyToHarvest}`,
      sub: 'Ready crop batches',
      progress: Math.min(100, readyToHarvest * 20),
    },
    {
      label: 'Autonomy Mode',
      value: sol?.agent.in_warmup ? 'Warmup' : 'Active',
      tone: sol?.agent.in_warmup ? 'orange' : 'cyan',
      sub: 'RL training state',
      progress: sol?.agent.in_warmup ? 36 : 82,
    },
  ]

  return (
    <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`relative overflow-hidden rounded-[22px] border p-4 backdrop-blur-xl shadow-[0_16px_40px_rgba(0,0,0,0.24)] md:p-5 ${toneClasses(
            item.tone,
          )}`}
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.025),transparent_42%)]" />

          <div className="relative flex min-h-[184px] flex-col">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/42">
                {item.label}
              </p>
              <div className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/40">
                Live
              </div>
            </div>

            <p className="mt-4 break-words text-[34px] font-semibold leading-none tracking-[-0.055em] text-white md:text-[40px]">
              {item.value}
            </p>

            <p className="mt-3 text-sm leading-6 text-white/50">{item.sub}</p>

            <div className="mt-auto pt-5">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/8">
                <div
                  className={`h-full rounded-full ${progressTone(item.tone)} shadow-[0_0_18px_rgba(255,255,255,0.12)]`}
                  style={{ width: `${Math.max(6, Math.min(100, item.progress))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}