import type { DailyResponse, HealthResponse, MissionSummary } from '@/types/greenhouse'
import InfoTooltip from '@/components/dashboard/InfoTooltip'

interface MissionHeaderProps {
  health: HealthResponse | null
  missionSummary: MissionSummary | null
  selectedSol: DailyResponse
  sectionLoading: boolean
}

function missionTone(status?: MissionSummary['mission_status']) {
  switch (status) {
    case 'critical':
      return 'border-red-400/20 bg-red-500/10 text-red-100'
    case 'caution':
      return 'border-orange-400/20 bg-orange-500/10 text-orange-100'
    default:
      return 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
  }
}

function StatPill({
  label,
  value,
  tone,
  tooltip,
}: {
  label: string
  value: string
  tone?: string
  tooltip: string
}) {
  return (
    <InfoTooltip content={tooltip} position="top">
      <div
        className={`rounded-[20px] border px-4 py-3 backdrop-blur-xl ${
          tone ?? 'border-white/10 bg-black/20'
        }`}
      >
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">
          {label}
        </p>
        <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.04em] text-white">
          {value}
        </p>
      </div>
    </InfoTooltip>
  )
}

export default function MissionHeader({
  health,
  missionSummary,
  selectedSol,
  sectionLoading,
}: MissionHeaderProps) {
  return (
    <section className="relative z-10 overflow-visible rounded-[30px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_28px_90px_rgba(0,0,0,0.42)] md:p-6 xl:p-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(196,106,45,0.18),transparent_24%),radial-gradient(circle_at_left,rgba(64,168,196,0.10),transparent_22%),linear-gradient(to_bottom,rgba(255,255,255,0.025),transparent_44%)]" />

      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.9fr)] xl:items-end">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-white/50">
            <span className="h-2 w-2 rounded-full bg-[#c46a2d] shadow-[0_0_18px_rgba(196,106,45,0.75)]" />
            Mars Greenhouse Mission
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.065em] text-white md:text-5xl xl:text-6xl">
            Mission Control
          </h1>

          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/64 md:text-[16px] md:leading-8">
            Operate the greenhouse, inspect autonomous decisions, and track
            mission viability across the full simulation window with a cleaner
            command-surface view.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/65">
              Sol {selectedSol.day}
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/60">
              {selectedSol.summary}
            </div>
            <div className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
              {sectionLoading ? 'Refreshing telemetry...' : 'Telemetry live'}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatPill
            label="Current Sol"
            value={`${health?.sol ?? '-'}`}
            tooltip="The latest simulated Martian day available from mission control."
          />
          <StatPill
            label="Remaining"
            value={`${health?.sols_remaining ?? '-'}`}
            tooltip="Number of sols left before the 450-sol mission window is complete."
          />
          <StatPill
            label="Mission Status"
            value={missionSummary?.mission_status ?? 'Nominal'}
            tone={missionTone(missionSummary?.mission_status)}
            tooltip="High-level health flag derived from critical resource state and recent reward performance."
          />
        </div>
      </div>
    </section>
  )
}
