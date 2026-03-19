import type { MissionSummary, StepSize } from '@/types/greenhouse'

interface SimulationControlsProps {
  missionSummary: MissionSummary | null
  pendingStepCount: StepSize | null
  missionComplete: boolean
  error: string | null
  onRun: (count: StepSize) => void
}

const STEPS: StepSize[] = [1, 10, 50]

export default function SimulationControls({
  missionSummary,
  pendingStepCount,
  missionComplete,
  error,
  onRun,
}: SimulationControlsProps) {
  const disabled = missionComplete || pendingStepCount !== null

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
            Simulation Control
          </p>
          <p className="mt-2 text-sm text-white/65">
            Advance the greenhouse mission and inspect the latest state returned by the backend.
          </p>
          {missionSummary && (
            <p className="mt-2 text-sm text-white/45">
              Avg reward: {missionSummary.avg_daily_reward.toFixed(3)} · Agent trained:{' '}
              {missionSummary.agent_sols_trained}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {STEPS.map((step) => {
            const active = pendingStepCount === step

            return (
              <button
                key={step}
                onClick={() => onRun(step)}
                disabled={disabled}
                className="rounded-full border border-white/12 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {active ? `Running ${step}...` : `Run ${step}`}
              </button>
            )
          })}
        </div>
      </div>

      {missionComplete && (
        <div className="mt-4 rounded-2xl border border-orange-400/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
          Mission complete. No reset endpoint exists yet, so restarting the backend is required for a fresh run.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}
    </section>
  )
}