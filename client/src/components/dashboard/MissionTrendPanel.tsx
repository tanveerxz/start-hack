import { useMemo, useState } from 'react'
import type { DailyResponse, TimelinePoint } from '@/types/greenhouse'

interface MissionTrendPanelProps {
  sol: DailyResponse | null
  timelinePoints?: TimelinePoint[]
  expanded?: boolean
}

interface TrendDatum {
  label: string
  day: number
  rewardPct: number
  caloriePct: number
  proteinPct: number
  recyclingPct: number
  rewardValue: number
  anyCritical: boolean
}

function buildPath(values: number[], width: number, height: number) {
  if (values.length === 0) return ''
  const stepX = values.length > 1 ? width / (values.length - 1) : width

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

function buildSeries(sol: DailyResponse | null, timelinePoints: TimelinePoint[] = []): TrendDatum[] {
  const sorted = [...timelinePoints].sort((a, b) => a.day - b.day)

  if (sorted.length > 1) {
    const latestDay = sorted[sorted.length - 1].day
    const windowed = sorted.slice(-12)

    return windowed.map((point) => ({
      label: point.day === latestDay ? 'Now' : `-${latestDay - point.day}`,
      day: point.day,
      rewardPct: Math.max(0, Math.min(100, 50 + point.reward * 50)),
      caloriePct: Math.max(0, Math.min(100, point.calorieCoveragePct)),
      proteinPct: Math.max(0, Math.min(100, point.proteinCoveragePct)),
      recyclingPct: Math.max(0, Math.min(100, point.recyclingRatioPct * 100)),
      rewardValue: point.reward,
      anyCritical: point.anyCritical,
    }))
  }

  if (!sol) {
    return [42, 48, 46, 52, 58, 54, 61, 57, 62, 66, 63, 69].map((value, index) => ({
      label: index === 11 ? 'Now' : `-${11 - index}`,
      day: index + 1,
      rewardPct: value,
      caloriePct: Math.max(12, value - 8),
      proteinPct: Math.max(10, value - 12),
      recyclingPct: Math.max(20, value - 16),
      rewardValue: (value - 50) / 50,
      anyCritical: false,
    }))
  }

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
  ].map((value, index) => ({
    label: index === 11 ? 'Now' : `-${11 - index}`,
    day: Math.max(1, sol.day - (11 - index)),
    rewardPct: Math.min(92, value),
    caloriePct: Math.max(12, Math.min(92, value - 8 + (index % 2) * 2)),
    proteinPct: Math.max(12, Math.min(92, value - 12 + (index % 3) * 3)),
    recyclingPct: Math.max(18, Math.min(92, value - 16 + (index % 2) * 4)),
    rewardValue: sol.reward.total,
    anyCritical: sol.resources.any_critical,
  }))
}

export default function MissionTrendPanel({
  sol,
  timelinePoints = [],
  expanded = false,
}: MissionTrendPanelProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const points = useMemo(() => buildSeries(sol, timelinePoints), [sol, timelinePoints])

  const width = 760
  const height = expanded ? 360 : 320
  const activeIndex = hoveredIndex ?? Math.max(points.length - 1, 0)
  const activePoint = points[activeIndex]

  const rewardSeries = points.map((point) => point.rewardPct)
  const calorieSeries = points.map((point) => point.caloriePct)
  const proteinSeries = points.map((point) => point.proteinPct)
  const pathReward = buildPath(rewardSeries, width, height)
  const pathCalorie = buildPath(calorieSeries, width, height)
  const pathProtein = buildPath(proteinSeries, width, height)
  const areaReward = buildAreaPath(pathReward, width, height)
  const stepX = points.length > 1 ? width / (points.length - 1) : width
  const activeX = points.length > 1 ? activeIndex * stepX : width / 2
  const activeRewardY = activePoint ? height - (activePoint.rewardPct / 100) * height : height / 2
  const activeCalorieY = activePoint ? height - (activePoint.caloriePct / 100) * height : height / 2
  const activeProteinY = activePoint ? height - (activePoint.proteinPct / 100) * height : height / 2

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
              Hover the mission window to inspect reward, nutrition coverage, and
              critical-state context across the cached simulation timeline.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100">
              Reward
            </div>
            <div className="rounded-full border border-violet-400/15 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-100">
              Calorie
            </div>
            <div className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100">
              Protein
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
              Relative Score
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

              <path d={areaReward} fill="url(#missionArea)" />
              <path
                d={pathCalorie}
                fill="none"
                stroke="rgba(139,92,246,0.95)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pathProtein}
                fill="none"
                stroke="rgba(52,211,153,0.95)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pathReward}
                fill="none"
                stroke="rgba(34,211,238,0.95)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {activePoint && (
                <>
                  <line
                    x1={activeX}
                    x2={activeX}
                    y1={0}
                    y2={height}
                    stroke="rgba(255,255,255,0.18)"
                    strokeDasharray="6 7"
                  />
                  <circle cx={activeX} cy={activeRewardY} r="5.5" fill="rgba(34,211,238,0.98)" />
                  <circle cx={activeX} cy={activeCalorieY} r="5" fill="rgba(139,92,246,0.98)" />
                  <circle cx={activeX} cy={activeProteinY} r="5" fill="rgba(52,211,153,0.98)" />
                </>
              )}
            </svg>

            <div className="absolute inset-0 grid grid-cols-12">
              {points.map((point, index) => (
                <button
                  key={`${point.day}-${index}`}
                  type="button"
                  aria-label={`Inspect sol ${point.day}`}
                  className="h-full w-full cursor-crosshair bg-transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onFocus={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onBlur={() => setHoveredIndex(null)}
                />
              ))}
            </div>

            {activePoint && (
              <div
                className="pointer-events-none absolute z-10 w-[220px] rounded-[18px] border border-white/10 bg-[#06080d]/92 px-4 py-3 text-sm text-white/78 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl"
                style={{
                  left: `${Math.max(16, Math.min(activeX + 32, width - 220))}px`,
                  top: `${Math.max(16, activeRewardY - 76)}px`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                    Sol {activePoint.day}
                  </p>
                  <div
                    className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
                      activePoint.anyCritical
                        ? 'border-red-400/20 bg-red-500/10 text-red-100'
                        : 'border-cyan-400/15 bg-cyan-400/10 text-cyan-100'
                    }`}
                  >
                    {activePoint.anyCritical ? 'Critical' : 'Stable'}
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <p className="text-cyan-100">Reward: {activePoint.rewardValue.toFixed(3)}</p>
                  <p className="text-violet-100">
                    Calorie coverage: {activePoint.caloriePct.toFixed(1)}%
                  </p>
                  <p className="text-emerald-100">
                    Protein coverage: {activePoint.proteinPct.toFixed(1)}%
                  </p>
                  <p className="text-white/68">
                    Recycling: {activePoint.recyclingPct.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.22em] text-white/34">
              Relative Sol Offset
            </div>
            <div className="absolute bottom-5 left-0 right-0 flex justify-between px-2 text-xs text-white/34 md:px-3">
              {points.map((point) => (
                <span key={`${point.day}-${point.label}`}>{point.label}</span>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                Active Reward
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                {activePoint ? activePoint.rewardValue.toFixed(3) : '-'}
              </p>
            </div>
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                Active Coverage
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                {activePoint ? `${activePoint.caloriePct.toFixed(1)}%` : '-'}
              </p>
            </div>
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                Protein / Recycling
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                {activePoint
                  ? `${activePoint.proteinPct.toFixed(1)}% / ${activePoint.recyclingPct.toFixed(1)}%`
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
