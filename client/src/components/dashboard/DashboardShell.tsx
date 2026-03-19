import type { PropsWithChildren } from 'react'

interface DashboardShellProps extends PropsWithChildren {}

export default function DashboardShell({ children }: DashboardShellProps) {
  return (
    <main className="min-h-screen overflow-x-clip bg-[#03050a] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(64,168,196,0.12),transparent_20%),radial-gradient(circle_at_88%_8%,rgba(196,106,45,0.18),transparent_18%),radial-gradient(circle_at_50%_100%,rgba(115,210,255,0.08),transparent_20%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_22%)]" />
        <div className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.36))]" />
        <div className="absolute left-[12%] top-24 h-72 w-72 rounded-full bg-cyan-400/[0.05] blur-[120px]" />
        <div className="absolute right-[8%] top-16 h-80 w-80 rounded-full bg-orange-400/[0.06] blur-[140px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1700px] flex-col gap-4 px-4 py-4 md:gap-5 md:px-6 md:py-6 xl:gap-6 xl:px-8 xl:py-8 2xl:px-10">
        {children}
      </div>
    </main>
  )
}