import type { EnvironmentData } from '@/types/greenhouse'
import InfoTooltip from '@/components/dashboard/InfoTooltip'

interface EnvironmentPanelProps {
  environment: EnvironmentData | null
  compact?: boolean
}

function MetricCard({
  label,
  value,
  sub,
  tooltip,
}: {
  label: string
  value: string
  sub: string
  tooltip: string
}) {
  return (
    <InfoTooltip content={tooltip}>
      <div className="rounded-[18px] border border-white/8 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
          {label}
        </p>
        <p className="mt-3 break-words text-[26px] font-semibold leading-none tracking-[-0.04em] text-white md:text-[30px]">
          {value}
        </p>
        <p className="mt-3 text-sm leading-6 text-white/46">{sub}</p>
      </div>
    </InfoTooltip>
  )
}

export default function EnvironmentPanel({
  environment,
  compact = false,
}: EnvironmentPanelProps) {
  const metrics = [
    ['Temperature', environment ? `${environment.temp_celsius.toFixed(1)} C` : '-', 'Thermal control band', 'Greenhouse air temperature around the crop canopy.'],
    ['Humidity', environment ? `${environment.humidity_rh.toFixed(1)} %` : '-', 'Relative humidity', 'Relative humidity in the greenhouse atmosphere.'],
    ['CO2', environment ? `${environment.co2_ppm.toFixed(0)} ppm` : '-', 'Atmospheric enrichment', 'Carbon dioxide concentration available for photosynthesis.'],
    ['PAR', environment ? `${environment.par_umol_m2s.toFixed(0)} umol/m²/s` : '-', 'Photosynthetic radiation', 'Usable light delivered to crops for growth.'],
    ['pH', environment ? environment.ph.toFixed(2) : '-', 'Root-zone acidity', 'Nutrient solution acidity and uptake balance.'],
    ['EC', environment ? `${environment.ec_ms_cm.toFixed(2)} mS/cm` : '-', 'Solution conductivity', 'Proxy for dissolved nutrient strength in the solution.'],
    ['Water Reserve', environment ? `${environment.water_liters_available.toFixed(1)} L` : '-', 'Immediate water availability', 'Water currently available before more recovery or extraction is required.'],
    ['Power Reserve', environment ? `${environment.power_kwh_available.toFixed(1)} kWh` : '-', 'Current power availability', 'Usable power capacity for lighting, pumping, and climate control.'],
  ]

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.34)] md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(64,168,196,0.08),transparent_26%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_44%)]" />

      <div className="relative">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">
              Environment
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
              Greenhouse Conditions
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-white/58">
              Climate, nutrient solution balance, and energy support for crop growth.
            </p>
          </div>

          <div className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
            {environment?.growth_system ?? 'Unknown system'}
          </div>
        </div>

        <div
          className={`grid gap-3 ${
            compact
              ? 'md:grid-cols-2 2xl:grid-cols-4'
              : 'md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
          }`}
        >
          {metrics.map(([label, value, sub, tooltip]) => (
            <MetricCard key={label} label={label} value={value} sub={sub} tooltip={tooltip} />
          ))}
        </div>
      </div>
    </section>
  )
}
