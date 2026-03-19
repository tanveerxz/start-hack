import type { AgentData, RewardData } from '@/types/greenhouse'
import InfoTooltip from '@/components/dashboard/InfoTooltip'

interface RewardBreakdownPanelProps {
  reward: RewardData | null
  agent: AgentData | null
}

function ScoreBar({
  label,
  score,
  contribution,
  note,
  tone,
}: {
  label: string
  score: number
  contribution: number
  note: string
  tone: string
}) {
  return (
    <InfoTooltip content={note}>
      <div className="rounded-[18px] border border-white/8 bg-black/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{score.toFixed(3)}</p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/66">
            Contrib {contribution.toFixed(3)}
          </div>
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/8">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(4, Math.min(100, score * 100))}%` }} />
        </div>
      </div>
    </InfoTooltip>
  )
}

export default function RewardBreakdownPanel({
  reward,
  agent,
}: RewardBreakdownPanelProps) {
  return (
    <section className="relative h-fit self-start overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.34)] md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(196,106,45,0.08),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_46%)]" />

      <div className="relative">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Reward</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
              Reward Breakdown
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-white/58">
              Inspect how nutrition, efficiency, stress, and critical safety combine into the current RL signal.
            </p>
          </div>

          <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
            Total {reward ? reward.total.toFixed(3) : '-'}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ScoreBar
            label="Nutrition"
            score={reward?.nutrition_score ?? 0}
            contribution={reward?.nutrition_contribution ?? 0}
            note={reward?.nutrition_note ?? 'Nutrition reward note unavailable.'}
            tone="bg-violet-300"
          />
          <ScoreBar
            label="Efficiency"
            score={reward?.efficiency_score ?? 0}
            contribution={reward?.efficiency_contribution ?? 0}
            note={reward?.efficiency_note ?? 'Efficiency reward note unavailable.'}
            tone="bg-cyan-300"
          />
          <ScoreBar
            label="Stress"
            score={reward?.stress_score ?? 0}
            contribution={reward?.stress_contribution ?? 0}
            note={reward?.stress_note ?? 'Stress reward note unavailable.'}
            tone="bg-orange-300"
          />
          <ScoreBar
            label="Critical"
            score={reward?.critical_score ?? 0}
            contribution={reward?.critical_contribution ?? 0}
            note={reward?.critical_note ?? 'Critical reward note unavailable.'}
            tone="bg-red-300"
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoTooltip content="Reward signal fed back into the agent for this sol.">
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">Reward Received</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {agent ? agent.reward_received.toFixed(3) : '-'}
              </p>
            </div>
          </InfoTooltip>
          <InfoTooltip content="Current RL learning rate after decay.">
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">Learning Rate</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {agent ? agent.learning_rate.toFixed(4) : '-'}
              </p>
            </div>
          </InfoTooltip>
          <InfoTooltip content="Cumulative reward earned by the agent across the mission so far.">
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">Cumulative Reward</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {agent ? agent.cumulative_reward.toFixed(2) : '-'}
              </p>
            </div>
          </InfoTooltip>
          <InfoTooltip content="Recent moving average reward used to assess short-term controller performance.">
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">Recent Avg</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {typeof agent?.recent_avg_reward === 'number' ? agent.recent_avg_reward.toFixed(3) : '-'}
              </p>
            </div>
          </InfoTooltip>
        </div>
      </div>
    </section>
  )
}
