import type { EnvironmentData } from '@/types/greenhouse'

interface EnvironmentPanelProps {
  environment: EnvironmentData | null
}

const metricClass =
  'rounded-2xl border border-white/8 bg-black/20 p-3'

export default function EnvironmentPanel({
  environment,
}: EnvironmentPanelProps) {
  const metrics = [
    ['Temperature', environment ? `${environment.temp_celsius.toFixed(1)} °C` : '—'],
    ['Humidity', environment ? `${environment.humidity_rh.toFixed(1)} %` : '—'],
    ['CO₂', environment ? `${environment.co2_ppm.toFixed(0)} ppm` : '—'],
    ['PAR', environment ? `${environment.par_umol_m2s.toFixed(0)} µmol/m²/s` : '—'],
    ['pH', environment ? environment.ph.toFixed(2) : '—'],
    ['EC', environment ? `${environment.ec_ms_cm.toFixed(2)} mS/cm` : '—'],
    ['Water', environment ? `${environment.water_liters_available.toFixed(1)} L` : '—'],
    ['Power', environment ? `${environment.power_kwh_available.toFixed(1)} kWh` : '—'],
  ]

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
            Environment
          </p>
          <h2 className="mt-2 text-xl font-semibold">Greenhouse Conditions</h2>
        </div>

        <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
          {environment?.growth_system ?? '—'}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {metrics.map(([label, value]) => (
          <div key={label} className={metricClass}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">
              {label}
            </p>
            <p className="mt-2 text-lg font-medium text-white">{value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}