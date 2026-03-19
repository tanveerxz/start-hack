import type { PropsWithChildren, ReactNode } from 'react'

interface DashboardShellProps extends PropsWithChildren {
  top?: ReactNode
}

export default function DashboardShell({ top, children }: DashboardShellProps) {
  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(180,88,35,0.22),transparent_25%),radial-gradient(circle_at_20%_10%,rgba(255,176,110,0.09),transparent_24%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_30%)]" />
        <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        {top}
        {children}
      </div>
    </main>
  )
}