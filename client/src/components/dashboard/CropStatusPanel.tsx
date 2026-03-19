import type { CropStatus } from '@/types/greenhouse'
import InfoTooltip from '@/components/dashboard/InfoTooltip'

interface CropStatusPanelProps {
  cropStatuses: CropStatus[]
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export default function CropStatusPanel({ cropStatuses }: CropStatusPanelProps) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.34)] md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(64,168,196,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(196,106,45,0.08),transparent_24%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_46%)]" />

      <div className="relative">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Crops</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
              Crop Status Matrix
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-white/58">
              Growth, maturity, projected yield, and stress density for each active crop batch.
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/72">
            {cropStatuses.length} active crop batches
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cropStatuses.length > 0 ? (
            cropStatuses.map((crop) => (
              <div key={crop.crop_type} className="rounded-[18px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">Crop Batch</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{crop.crop_type}</h3>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${
                    crop.ready_to_harvest
                      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                      : crop.is_stressed
                        ? 'border-orange-400/20 bg-orange-500/10 text-orange-100'
                        : 'border-cyan-400/15 bg-cyan-400/10 text-cyan-100'
                  }`}>
                    {crop.ready_to_harvest ? 'Ready' : crop.is_stressed ? 'Stressed' : 'Nominal'}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-white/72 sm:grid-cols-2">
                  <InfoTooltip content="Days this crop batch has been growing since planting.">
                    <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
                      Days grown: <span className="text-white">{crop.days_grown}</span>
                    </div>
                  </InfoTooltip>
                  <InfoTooltip content="Remaining sols until the minimum harvest window opens.">
                    <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
                      To harvest: <span className="text-white">{crop.days_to_min_harvest}</span>
                    </div>
                  </InfoTooltip>
                  <InfoTooltip content="Current-day growth rate from the crop simulation. 1.0 is ideal growth.">
                    <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
                      Growth today: <span className="text-white">{pct(crop.growth_rate_today)}</span>
                    </div>
                  </InfoTooltip>
                  <InfoTooltip content="Number of active stress reports attached to this crop batch.">
                    <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
                      Stress count: <span className="text-white">{crop.stress_count}</span>
                    </div>
                  </InfoTooltip>
                </div>

                <div className="mt-4 space-y-3">
                  <InfoTooltip content="Accumulated crop growth score since planting.">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/38">
                        <span>Cumulative growth</span>
                        <span>{crop.cumulative_growth.toFixed(2)}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, crop.cumulative_growth * 4)}%` }} />
                      </div>
                    </div>
                  </InfoTooltip>

                  <InfoTooltip content="Projected harvest yield for this crop normalized per square meter.">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/38">
                        <span>Yield projection</span>
                        <span>{crop.projected_yield_kg_m2.toFixed(2)} kg/m²</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.min(100, crop.projected_yield_kg_m2 * 20)}%` }} />
                      </div>
                    </div>
                  </InfoTooltip>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[18px] border border-white/8 bg-black/20 p-4 text-sm text-white/58">
              No active crop batches are available for this sol.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
