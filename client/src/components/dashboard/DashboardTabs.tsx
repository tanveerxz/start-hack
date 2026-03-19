'use client'

export type DashboardTab = 'overview' | 'environment' | 'resources' | 'systems'

interface DashboardTabsProps {
  activeTab: DashboardTab
  onChange: (tab: DashboardTab) => void
}

const TABS: { key: DashboardTab; label: string; sub: string }[] = [
  { key: 'overview', label: 'Overview', sub: 'Mission snapshot' },
  { key: 'environment', label: 'Environment', sub: 'Climate + hydroponics' },
  { key: 'resources', label: 'Resources', sub: 'Water + nutrients' },
  { key: 'systems', label: 'Systems', sub: 'Agent + activity' },
]

export default function DashboardTabs({
  activeTab,
  onChange,
}: DashboardTabsProps) {
  return (
    <section className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] p-2 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_20px_60px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(64,168,196,0.05),transparent_40%,rgba(196,106,45,0.05))]" />

      <div className="relative grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {TABS.map((tab) => {
          const active = activeTab === tab.key

          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`rounded-[18px] border px-4 py-3 text-left transition-all duration-300 ${
                active
                  ? 'border-white/15 bg-white/[0.08] shadow-[0_12px_30px_rgba(0,0,0,0.22)]'
                  : 'border-transparent bg-transparent hover:border-white/10 hover:bg-white/[0.04]'
              }`}
            >
              <p className="text-sm font-medium text-white">{tab.label}</p>
              <p className="mt-1 text-xs text-white/45">{tab.sub}</p>
            </button>
          )
        })}
      </div>
    </section>
  )
}