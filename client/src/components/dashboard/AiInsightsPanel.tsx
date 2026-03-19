'use client'

import type {
  ClaudeNextStep,
  ClaudeRecommendation,
  RecommendationPriority,
} from '@/types/greenhouse'
import InfoTooltip from '@/components/dashboard/InfoTooltip'

interface AiInsightsPanelProps {
  recommendation: ClaudeRecommendation | null
  loading?: boolean
  error?: string | null
  onGenerate?: () => void
}

const riskToneStyles: Record<
  ClaudeRecommendation['crew_risk_level'],
  { border: string; bg: string; text: string }
> = {
  low: {
    border: 'border-emerald-400/20',
    bg: 'bg-emerald-400/10',
    text: 'text-emerald-100',
  },
  medium: {
    border: 'border-amber-400/20',
    bg: 'bg-amber-400/10',
    text: 'text-amber-100',
  },
  high: {
    border: 'border-red-400/20',
    bg: 'bg-red-400/10',
    text: 'text-red-100',
  },
  unknown: {
    border: 'border-white/10',
    bg: 'bg-white/[0.06]',
    text: 'text-white/80',
  },
}

const priorityStyles: Record<
  RecommendationPriority,
  { border: string; bg: string; text: string }
> = {
  low: {
    border: 'border-cyan-400/20',
    bg: 'bg-cyan-400/10',
    text: 'text-cyan-100',
  },
  medium: {
    border: 'border-amber-400/20',
    bg: 'bg-amber-400/10',
    text: 'text-amber-100',
  },
  high: {
    border: 'border-orange-400/20',
    bg: 'bg-orange-400/10',
    text: 'text-orange-100',
  },
  critical: {
    border: 'border-red-400/20',
    bg: 'bg-red-400/10',
    text: 'text-red-100',
  },
}

function InsightStep({ step, index }: { step: ClaudeNextStep; index: number }) {
  const tone = priorityStyles[step.priority]

  return (
    <InfoTooltip content={step.rationale}>
      <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/38">
              Step {index + 1}
            </p>
            <h3 className="mt-2 text-[15px] font-semibold leading-6 text-white">
              {step.action}
            </h3>
          </div>

          <div
            className={`shrink-0 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${tone.border} ${tone.bg} ${tone.text}`}
          >
            {step.priority}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-white/62">{step.rationale}</p>
      </div>
    </InfoTooltip>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-16 rounded-[20px] border border-white/10 bg-white/[0.05] animate-pulse" />
      <div className="h-28 rounded-[20px] border border-white/10 bg-white/[0.05] animate-pulse" />
      <div className="h-28 rounded-[20px] border border-white/10 bg-white/[0.05] animate-pulse" />
    </div>
  )
}

export default function AiInsightsPanel({
  recommendation,
  loading = false,
  error = null,
  onGenerate,
}: AiInsightsPanelProps) {
  const riskTone = recommendation
    ? riskToneStyles[recommendation.crew_risk_level]
    : riskToneStyles.unknown

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.34)] md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(64,168,196,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(196,106,45,0.08),transparent_32%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_46%)]" />

      <div className="relative">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">
              Crew Guidance
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
              AI Insights
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onGenerate}
              disabled={!onGenerate || loading}
              className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-cyan-100 transition-all duration-300 hover:border-cyan-300/30 hover:bg-cyan-400/16 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? 'Generating...'
                : recommendation
                  ? 'Regenerate Insights'
                  : 'Generate AI Insights'}
            </button>

            <div
              className={`inline-flex rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.22em] ${riskTone.border} ${riskTone.bg} ${riskTone.text}`}
            >
              Risk Level {recommendation?.crew_risk_level ?? 'unknown'}
            </div>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <div className="rounded-[20px] border border-red-400/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
              {error}
            </div>
          ) : !recommendation ? (
            <div className="rounded-[20px] border border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/58">
              Generate AI insights for this sol to receive recommended next steps, risk
              assessment, and short-horizon outlook.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                  Status Summary
                </p>
                <p className="mt-3 text-[15px] leading-7 text-white/82">
                  {recommendation.status_summary}
                </p>
              </div>

              {recommendation.warnings.length > 0 && (
                <div className="rounded-[22px] border border-orange-400/18 bg-orange-500/8 p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-orange-100/70">
                    Warnings
                  </p>
                  <div className="mt-3 space-y-2">
                    {recommendation.warnings.map((warning, index) => (
                      <div
                        key={`${warning}-${index}`}
                        className="rounded-[16px] border border-white/8 bg-black/20 px-4 py-3 text-sm leading-6 text-white/76"
                      >
                        {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                    Next Steps
                  </p>
                  {recommendation.is_fallback && (
                    <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/52">
                      Fallback
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {recommendation.next_steps.length > 0 ? (
                    recommendation.next_steps.map((step, index) => (
                      <InsightStep
                        key={step.id || `${step.action}-${index}`}
                        step={step}
                        index={index}
                      />
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/58">
                      No actionable steps were returned for this sol.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                    Outlook
                  </p>
                  {recommendation.confidence !== null && (
                    <div className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                      Confidence {Math.round(recommendation.confidence * 100)}%
                    </div>
                  )}
                </div>
                <p className="mt-3 text-sm leading-7 text-white/68">{recommendation.outlook}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
