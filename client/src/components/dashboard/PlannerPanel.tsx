import type { PlantingEvent } from '@/types/greenhouse'
import InfoTooltip from '@/components/dashboard/InfoTooltip'

interface PlannerPanelProps {
  summary: string
  plantingEvents: PlantingEvent[]
  harvestEvents: string[]
}

function SettingBadge({ label, value, tooltip }: { label: string; value: string; tooltip: string }) {
  return (
    <InfoTooltip content={tooltip} position="top">
      <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs text-white/72">
        <span className="text-white/40">{label}: </span>
        <span className="text-white">{value}</span>
      </div>
    </InfoTooltip>
  )
}

export default function PlannerPanel({
  summary,
  plantingEvents,
  harvestEvents,
}: PlannerPanelProps) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.34)] md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(64,168,196,0.08),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_46%)]" />

      <div className="relative">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Planner</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
              Daily Operations
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-white/58">
              Planting targets, harvest decisions, and the planner narrative for this sol.
            </p>
          </div>

          <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
            {plantingEvents.length} plant / {harvestEvents.length} harvest
          </div>
        </div>

        <InfoTooltip content="One-line planner summary built by the backend from nutrition deficits and stress responses.">
          <div className="rounded-[18px] border border-white/8 bg-black/20 p-4 text-sm leading-7 text-white/74">
            {summary}
          </div>
        </InfoTooltip>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div className="grid gap-3">
            {plantingEvents.length > 0 ? (
              plantingEvents.map((event, index) => (
                <div key={`${event.crop_type}-${index}`} className="rounded-[18px] border border-white/8 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">Planting Event</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">
                        {event.crop_type} on {event.area_m2.toFixed(1)} m²
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-white/60">{event.notes}</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/56">
                      Harvest sol {event.expected_harvest_day}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <SettingBadge label="System" value={event.growth_system} tooltip="Assigned growth system for this planting batch." />
                    <SettingBadge label="PAR" value={`${event.target_par.toFixed(0)} umol`} tooltip="Target light intensity for this batch." />
                    <SettingBadge label="Temp" value={`${event.target_temp.toFixed(1)} C`} tooltip="Target air temperature for this crop batch." />
                    <SettingBadge label="CO2" value={`${event.target_co2_ppm.toFixed(0)} ppm`} tooltip="Target atmospheric carbon dioxide setpoint." />
                    <SettingBadge label="pH" value={event.target_ph.toFixed(2)} tooltip="Target nutrient solution acidity for this planting." />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-white/8 bg-black/20 p-4 text-sm text-white/58">
                No planting actions were scheduled for this sol.
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <InfoTooltip content="Crop batches marked ready and harvested by the planner for the current sol.">
              <div className="rounded-[18px] border border-white/8 bg-black/20 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">Harvest Queue</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {harvestEvents.length > 0 ? (
                    harvestEvents.map((crop) => (
                      <div key={crop} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-100">
                        {crop}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-white/58">No crops harvested this sol.</p>
                  )}
                </div>
              </div>
            </InfoTooltip>
          </div>
        </div>
      </div>
    </section>
  )
}
