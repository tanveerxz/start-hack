import type { StressAlert } from '@/types/greenhouse'
import InfoTooltip from '@/components/dashboard/InfoTooltip'

interface AlertsPanelProps {
  alerts: StressAlert[]
}

function severityTone(severity: number) {
  if (severity >= 0.7) return 'border-red-400/20 bg-red-500/10 text-red-100'
  if (severity >= 0.4) return 'border-orange-400/20 bg-orange-500/10 text-orange-100'
  return 'border-cyan-400/15 bg-cyan-400/10 text-cyan-100'
}

export default function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.34)] md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,106,45,0.08),transparent_24%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_46%)]" />

      <div className="relative">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Alerts</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
              Stress & Action Queue
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-white/58">
              Active backend stress detections with severity and recommended response.
            </p>
          </div>

          <div className={`rounded-full border px-4 py-2 text-sm ${
            alerts.length > 0
              ? 'border-orange-400/20 bg-orange-500/10 text-orange-100'
              : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
          }`}>
            {alerts.length > 0 ? `${alerts.length} active alerts` : 'No active alerts'}
          </div>
        </div>

        <div className="grid gap-3">
          {alerts.length > 0 ? (
            alerts.map((alert, index) => (
              <InfoTooltip
                key={`${alert.crop_type}-${alert.stress_type}-${index}`}
                content={`Detected on sol ${alert.day_detected}. Severity ${Math.round(alert.severity * 100)}%.`}
              >
                <div className="rounded-[18px] border border-white/8 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                        {alert.crop_type} / {alert.stress_type}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/76">{alert.recommended_action}</p>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${severityTone(alert.severity)}`}>
                      Severity {Math.round(alert.severity * 100)}%
                    </div>
                  </div>
                </div>
              </InfoTooltip>
            ))
          ) : (
            <div className="rounded-[18px] border border-white/8 bg-black/20 p-4 text-sm text-white/58">
              No crop or system stress alerts are active for this sol.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
