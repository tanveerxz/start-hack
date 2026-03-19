import { useMemo, useState } from 'react'
import type { MissionSummary, StepSize } from '@/types/greenhouse'

interface SimulationControlsProps {
  missionSummary: MissionSummary | null
  pendingStepCount: StepSize | null
  pendingReset: boolean
  canReset: boolean
  missionComplete: boolean
  error: string | null
  onRun: (count: StepSize) => void
  onReset: () => void
}

const STEPS: StepSize[] = [1, 10, 50]
const MAX_CUSTOM_STEP = 50

function RunButton({
  step,
  active,
  disabled,
  onClick,
}: {
  step: StepSize
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative overflow-hidden rounded-[20px] border px-4 py-4 text-left transition-all duration-300 ${
        active
          ? 'border-orange-300/30 bg-orange-400/15 shadow-[0_14px_36px_rgba(196,106,45,0.20)]'
          : 'border-white/10 bg-white/[0.045] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,106,45,0.14),transparent_52%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_44%)]" />

      <div className="relative flex flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/42">
              Execute
            </p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">
              Run {step}
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/48">
            Sols
          </div>
        </div>

        <p className="text-sm text-white/55">
          Advance {step} sol{step > 1 ? 's' : ''}
        </p>
      </div>
    </button>
  )
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/65">
      <span className="text-white/42">{label}: </span>
      <span className="text-white">{value}</span>
    </div>
  )
}

export default function SimulationControls({
  missionSummary,
  pendingStepCount,
  pendingReset,
  canReset,
  missionComplete,
  error,
  onRun,
  onReset,
}: SimulationControlsProps) {
  const [customStep, setCustomStep] = useState('5')
  const disabled = missionComplete || pendingStepCount !== null || pendingReset
  const parsedCustomStep = Number.parseInt(customStep, 10)
  const customStepValid =
    Number.isInteger(parsedCustomStep) &&
    parsedCustomStep >= 1 &&
    parsedCustomStep <= MAX_CUSTOM_STEP

  const customStepHint = useMemo(() => {
    if (customStep.trim() === '') return 'Enter a whole number between 1 and 50.'
    if (!customStepValid) return 'Manual step count must be a whole number from 1 to 50.'
    return `Run a custom ${parsedCustomStep}-sol sequence.`
  }, [customStep, customStepValid, parsedCustomStep])

  function handleCustomStepChange(value: string) {
    if (value === '') {
      setCustomStep('')
      return
    }

    if (!/^\d+$/.test(value)) return
    setCustomStep(value)
  }

  function handleCustomRun() {
    if (disabled || !customStepValid) return
    onRun(parsedCustomStep)
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_70px_rgba(0,0,0,0.32)] md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(196,106,45,0.10),transparent_22%),linear-gradient(to_right,rgba(64,168,196,0.05),transparent_35%)]" />

      <div className="relative grid gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.9fr)] 2xl:items-center">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">
            Command Surface
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-[2rem]">
            Advance the Mission Window
          </h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-white/62">
            Execute simulation steps, refresh the latest mission state, and
            inspect how reward, resource efficiency, nutrition coverage, and crop
            stability evolve sol by sol.
          </p>

          {missionSummary && (
            <div className="mt-5 flex flex-wrap gap-3">
              <MetricPill
                label="Avg reward"
                value={missionSummary.avg_daily_reward.toFixed(3)}
              />
              <MetricPill
                label="Calorie coverage"
                value={`${missionSummary.avg_calorie_coverage_pct.toFixed(1)}%`}
              />
              <MetricPill
                label="Recycling"
                value={`${missionSummary.avg_recycling_ratio_pct.toFixed(1)}%`}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((step) => (
              <RunButton
                key={step}
                step={step}
                active={pendingStepCount === step}
                disabled={disabled}
                onClick={() => onRun(step)}
              />
            ))}
          </div>

          <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/42">
                  Manual Step Mode
                </p>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  Enter a custom whole-number step count for tighter demo pacing or
                  specific mission jumps.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-end">
                <label className="flex min-w-0 flex-col gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                    Sol Count
                  </span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={customStep}
                    onChange={(event) => handleCustomStepChange(event.target.value)}
                    disabled={disabled}
                    className="min-w-[140px] rounded-[16px] border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition-all duration-300 placeholder:text-white/24 focus:border-cyan-300/30 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="1-50"
                    aria-label="Custom sol step count"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleCustomRun}
                  disabled={disabled || !customStepValid}
                  className="rounded-[16px] border border-cyan-400/15 bg-cyan-400/10 px-5 py-3 text-sm font-medium text-cyan-100 transition-all duration-300 hover:border-cyan-300/30 hover:bg-cyan-400/16 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Run Custom
                </button>
              </div>
            </div>

            <p
              className={`mt-3 text-sm ${
                customStep.trim() !== '' && !customStepValid ? 'text-orange-100' : 'text-white/50'
              }`}
            >
              {customStepHint}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
              {missionComplete ? 'Mission complete' : 'Manual step mode'}
            </div>

            {pendingStepCount !== null && !missionComplete && (
              <div className="rounded-full border border-orange-400/15 bg-orange-400/10 px-4 py-2 text-sm text-orange-100">
                Executing {pendingStepCount} sol{pendingStepCount > 1 ? 's' : ''}
              </div>
            )}

            {pendingReset && (
              <div className="rounded-full border border-red-400/15 bg-red-400/10 px-4 py-2 text-sm text-red-100">
                Resetting mission
              </div>
            )}

            <button
              type="button"
              onClick={onReset}
              disabled={!canReset || pendingStepCount !== null || pendingReset}
              className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-100 transition-all duration-300 hover:border-red-300/35 hover:bg-red-400/16 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingReset ? 'Resetting...' : 'Reset Mission'}
            </button>
          </div>
        </div>
      </div>

      {missionComplete && (
        <div className="relative mt-5 rounded-[18px] border border-orange-400/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
          Mission complete. Restart to simulate another.
        </div>
      )}

      {error && (
        <div className="relative mt-4 rounded-[18px] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}
    </section>
  )
}
