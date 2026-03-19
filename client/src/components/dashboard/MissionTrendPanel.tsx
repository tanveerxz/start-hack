import type { DailyResponse } from '@/types/greenhouse'

interface MissionTrendPanelProps {
  sol: DailyResponse | null
  expanded?: boolean
}

function buildSeries(sol: DailyResponse | null) {
  if (!sol) return [42, 48, 46, 52, 58, 54, 61, 57, 62, 66, 63, 69]

  const rewardBase = 52 + sol.reward.total * 6
  const calorieBase = sol.nutrition.calorie_coverage_pct * 0.55
  const proteinBase = sol.nutrition.protein_coverage_pct * 0.42

  return [
    Math.max(12, rewardBase * 0.76 + 6),
    Math.max(12, calorieBase * 0.72 + 8),
    Math.max(12, proteinBase * 0.6 + 12),
    Math.max(12, calorieBase * 0.84 + 9),
    Math.max(12, rewardBase * 0.88 + 7),
    Math.max(12, proteinBase * 0.78 + 11),
    Math.max(12, calorieBase * 0.92 + 8),
    Math.max(12, rewardBase * 0.96 + 9),
    Math.max(12, proteinBase * 0.86 + 10),
    Math.max(12, calorieBase * 1.02 + 8),
    Math.max(12, rewardBase * 1.04 + 8),
    Math.max(12, proteinBase * 0.94 + 11),
  ].map((n) => Math.min(92, n))
}

function buildPath(values: number[], width: number, height: number) {
  if (values.length === 0) return ''
  const stepX = width / (values.length - 1)

  return values
    .map((value, index) => {
      const x = index * stepX
      const y = height - (value / 100) * height
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

function buildAreaPath(linePath: string, width: number, height: number) {
  if (!linePath) return ''
  return `${linePath} L ${width} ${height} L 0 ${height} Z`
}

export default function MissionTrendPanel({
  sol,
  expanded = false,
}: MissionTrendPanelProps) {
  const seriesA = buildSeries(sol)
  const seriesB = seriesA.map((value, i) => Math.max(8, Math.min(95, value - 8 + (i % 3) * 4)))

  const width = 760
  const height = expanded ? 360 : 320

  const pathA = buildPath(seriesA, width, height)
  const pathB = buildPath(seriesB, width, height)
  const areaA = buildAreaPath(pathA, width, height)

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.34)] md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(64,168,196,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(196,106,45,0.08),transparent_26%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_48%)]" />

      <div className="relative">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">
              Mission Trend
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
              Mission Performance Curve
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-white/58">
              Synthetic trend surface for reward, nutrition coverage, and mission
              stability signals around the current sol.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100">
              Reward
            </div>
            <div className="rounded-full border border-violet-400/15 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-100">
              Coverage
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[22px] border border-white/8 bg-black/20 p-4 md:p-5">
          <div className="relative h-[320px] w-full overflow-hidden rounded-[18px] md:h-[360px]">
            <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.20)_1px,transparent_1px)] [background-size:100%_25%]" />
            <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(90deg,rgba(255,255,255,0.30)_1px,transparent_1px)] [background-size:8.333%_100%]" />
            <div className="pointer-events-none absolute left-2 top-4 flex h-[calc(100%-4rem)] flex-col justify-between text-[10px] uppercase tracking-[0.14em] text-white/28">
              <span>100</span>
              <span>75</span>
              <span>50</span>
              <span>25</span>
              <span>0</span>
            </div>
            <div className="pointer-events-none absolute left-[-34px] top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase tracking-[0.22em] text-white/34">
              Mission Signal
            </div>

            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="missionArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.28)" />
                  <stop offset="100%" stopColor="rgba(34,211,238,0.02)" />
                </linearGradient>
              </defs>

              <path d={areaA} fill="url(#missionArea)" />
              <path
                d={pathB}
                fill="none"
                stroke="rgba(139,92,246,0.95)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pathA}
                fill="none"
                stroke="rgba(34,211,238,0.95)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.22em] text-white/34">
              Relative Sol Offset
            </div>
            <div className="absolute bottom-5 left-0 right-0 flex justify-between px-2 text-xs text-white/34 md:px-3">
              {['-11', '-10', '-9', '-8', '-7', '-6', '-5', '-4', '-3', '-2', '-1', 'Now'].map(
                (label) => (
                  <span key={label}>{label}</span>
                ),
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                Reward
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                {sol ? sol.reward.total.toFixed(3) : '—'}
              </p>
            </div>
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                Calorie Coverage
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                {sol ? `${sol.nutrition.calorie_coverage_pct.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                Recycling
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                {sol ? `${sol.resources.recycling_ratio.toFixed(1)}%` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
