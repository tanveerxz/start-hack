import type { HealthResponse, MissionSummary } from '@/types/greenhouse'

interface MissionHeaderProps {
  health: HealthResponse | null
  missionSummary: MissionSummary | null
}

function missionTone(status?: MissionSummary['mission_status']) {
  switch (status) {
    case 'critical':
      return 'text-red-300 border-red-400/30 bg-red-500/10'
    case 'caution':
      return 'text-orange-200 border-orange-400/30 bg-orange-500/10'
    default:
      return 'text-cyan-200 border-cyan-400/30 bg-cyan-500/10'
  }
}

export default function MissionHeader({
  health,
  missionSummary,
}: MissionHeaderProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl md:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/45">
            Mars Greenhouse Mission
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
            Mission Control
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/65 md:text-base">
            Run greenhouse simulations, inspect mission health, and monitor the
            autonomous planning system across the full 450-sol window.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
              Current Sol
            </p>
            <p className="mt-2 text-2xl font-semibold">{health?.sol ?? '—'}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
              Remaining
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {health?.sols_remaining ?? '—'}
            </p>
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 ${missionTone(
              missionSummary?.mission_status,
            )}`}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
              Mission Status
            </p>
            <p className="mt-2 text-lg font-semibold capitalize">
              {missionSummary?.mission_status ?? 'nominal'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}