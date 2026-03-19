'use client'

interface StatusFeedItem {
  label: string
  value: string
  tone?: 'default' | 'info' | 'warning' | 'danger' | 'success'
}

interface StatusFeedPanelProps {
  title: string
  eyebrow: string
  items: StatusFeedItem[]
}

const toneStyles: Record<
  NonNullable<StatusFeedItem['tone']>,
  { dot: string; text: string; bg: string }
> = {
  default: {
    dot: 'bg-white/50',
    text: 'text-white/80',
    bg: 'bg-white/[0.04]',
  },
  info: {
    dot: 'bg-cyan-400',
    text: 'text-cyan-100',
    bg: 'bg-cyan-400/10',
  },
  warning: {
    dot: 'bg-amber-400',
    text: 'text-amber-100',
    bg: 'bg-amber-400/10',
  },
  danger: {
    dot: 'bg-red-400',
    text: 'text-red-100',
    bg: 'bg-red-400/10',
  },
  success: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-100',
    bg: 'bg-emerald-400/10',
  },
}

export default function StatusFeedPanel({
  title,
  eyebrow,
  items,
}: StatusFeedPanelProps) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.34)] md:p-6">
      
      {/* subtle ambient gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,106,45,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.06),transparent_32%)]" />

      <div className="relative">
        {/* Header */}
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
            {title}
          </h2>
        </div>

        {/* Feed */}
        <div className="flex flex-col gap-3">
          {items.map((item, i) => {
            const tone = item.tone ?? 'default'
            const styles = toneStyles[tone]

            return (
              <div
                key={`${item.label}-${i}`}
                className={`group relative flex items-start gap-3 rounded-[18px] border border-white/8 px-4 py-3 transition-all duration-300 hover:border-white/14 hover:bg-white/[0.06] ${styles.bg}`}
              >
                {/* Dot */}
                <div className="mt-[6px] flex h-2.5 w-2.5 items-center justify-center">
                  <div
                    className={`h-2 w-2 rounded-full ${styles.dot} shadow-[0_0_8px_rgba(255,255,255,0.25)]`}
                  />
                </div>

                {/* Content */}
                <div className="flex flex-col">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">
                    {item.label}
                  </p>

                  <p
                    className={`mt-1 text-[14px] leading-6 font-medium ${styles.text}`}
                  >
                    {item.value}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}