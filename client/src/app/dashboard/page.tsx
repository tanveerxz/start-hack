'use client'

import DashboardShell from '@/components/dashboard/DashboardShell'
import EnvironmentPanel from '@/components/dashboard/EnvironmentPanel'
import KpiGrid from '@/components/dashboard/KpiGrid'
import MissionHeader from '@/components/dashboard/MissionHeader'
import ResourcesPanel from '@/components/dashboard/ResourcesPanel'
import SimulationControls from '@/components/dashboard/SimulationControls'
import { useMissionControl } from '@/hooks/useMissionControl'

export default function DashboardPage() {
  const {
    health,
    missionSummary,
    selectedSol,
    loading,
    sectionLoading,
    pendingStepCount,
    missionComplete,
    error,
    runStep,
  } = useMissionControl()

  if (loading) {
    return (
      <DashboardShell>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-white/70">
          Loading mission control...
        </div>
      </DashboardShell>
    )
  }

  if (!health || !selectedSol) {
    return (
      <DashboardShell>
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-red-100">
          {error ?? 'Failed to load dashboard state.'}
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      top={
        <MissionHeader health={health} missionSummary={missionSummary} />
      }
    >
      <SimulationControls
        missionSummary={missionSummary}
        pendingStepCount={pendingStepCount}
        missionComplete={missionComplete}
        error={error}
        onRun={(count) => void runStep(count)}
      />

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65 backdrop-blur-xl">
        <span className="font-medium text-white/90">Latest Summary:</span>{' '}
        {selectedSol.summary}
        {sectionLoading && (
          <span className="ml-3 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-100">
            Refreshing...
          </span>
        )}
      </div>

      <KpiGrid sol={selectedSol} />

      <div className="grid gap-4 xl:grid-cols-2">
        <EnvironmentPanel environment={selectedSol.environment} />
        <ResourcesPanel resources={selectedSol.resources} />
      </div>
    </DashboardShell>
  )
}