import type { Allocation, AgentData } from '@/types/greenhouse'
import InfoTooltip from '@/components/dashboard/InfoTooltip'

interface AllocationPanelProps {
  allocation: Allocation | null
  proposedAllocation?: AgentData['proposed_allocation'] | null
  missionAllocation?: Allocation | null
  inWarmup?: boolean
}

const CROP_META: {
  key: keyof Allocation
  label: string
  tone: string
  tooltip: string
}[] = [
  {
    key: 'potato_pct',
    label: 'Potato',
    tone: 'bg-orange-300',
    tooltip: 'Primary calorie backbone crop and the largest floor-space consumer.',
  },
  {
    key: 'legume_pct',
    label: 'Legume',
    tone: 'bg-emerald-300',
    tooltip: 'Primary plant-protein allocation for crew nutritional resilience.',
  },
  {
    key: 'lettuce_pct',
    label: 'Lettuce',
    tone: 'bg-cyan-300',
    tooltip: 'Fast leafy crop supporting micronutrients and harvest cadence.',
  },
  {
    key: 'radish_pct',
    label: 'Radish',
    tone: 'bg-fuchsia-300',
    tooltip: 'Short-cycle buffer crop used for quick harvest turnover.',
  },
  {
    key: 'herb_pct',
    label: 'Herb',
    tone: 'bg-amber-200',
    tooltip: 'Low-area diversity crop supporting morale and diet variety.',
  },
]

function percent(value: number | undefined) {
  if (typeof value !== 'number') return '-'
  return `${(value * 100).toFixed(1)}%`
}

function AllocationRow({
  label,
  current,
  proposed,
  mission,
  tone,
  tooltip,
}: {
  label: string
  current?: number
  proposed?: number
  mission?: number
  tone: string
  tooltip: string
}) {
  const currentPct = typeof current === 'number' ? current * 100 : 0
  const proposedPct = typeof proposed === 'number' ? proposed * 100 : 0
  const missionPct = typeof mission === 'number' ? mission * 100 : 0

  return (
    <InfoTooltip content={tooltip}>
      <div className="rounded-[18px] border border-white/8 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${tone}`} />
            <p className="text-sm font-medium text-white">{label}</p>
          </div>
          <p className="text-sm text-white/45">Current / Agent / Mission</p>
        </div>

        <div className="mt-3 grid gap-2 text-sm text-white/72 md:grid-cols-3">
          <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
            Current: <span className="text-white">{percent(current)}</span>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
            Agent: <span className="text-white">{percent(proposed)}</span>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
            Mission: <span className="text-white">{percent(mission)}</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/38">
              <span>Current</span>
              <span>{percent(current)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
              <div className={`h-full rounded-full ${tone}`} style={{ width: `${currentPct}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/38">
              <span>Agent</span>
              <span>{percent(proposed)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-white/40" style={{ width: `${proposedPct}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/38">
              <span>Mission</span>
              <span>{percent(mission)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-cyan-200/70" style={{ width: `${missionPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </InfoTooltip>
  )
}

export default function AllocationPanel({
  allocation,
  proposedAllocation,
  missionAllocation,
  inWarmup = false,
}: AllocationPanelProps) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.34)] md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,106,45,0.08),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_46%)]" />

      <div className="relative">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Allocation</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
              Crop Space Allocation
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-white/58">
              Compare the live planner split, the RL proposal, and the current mission snapshot.
            </p>
          </div>

          <div className={`rounded-full border px-4 py-2 text-sm ${
            inWarmup
              ? 'border-orange-400/20 bg-orange-500/10 text-orange-100'
              : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
          }`}>
            {inWarmup ? 'Warmup allocation mode' : 'RL allocation visible'}
          </div>
        </div>

        <div className="grid gap-3">
          {CROP_META.map((crop) => (
            <AllocationRow
              key={crop.key}
              label={crop.label}
              current={allocation?.[crop.key]}
              proposed={proposedAllocation?.[crop.key]}
              mission={missionAllocation?.[crop.key]}
              tone={crop.tone}
              tooltip={crop.tooltip}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
