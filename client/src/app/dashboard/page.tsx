'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import DashboardShell from '@/components/dashboard/DashboardShell'
import EnvironmentPanel from '@/components/dashboard/EnvironmentPanel'
import KpiGrid from '@/components/dashboard/KpiGrid'
import MissionHeader from '@/components/dashboard/MissionHeader'
import ResourcesPanel from '@/components/dashboard/ResourcesPanel'
import SimulationControls from '@/components/dashboard/SimulationControls'
import DashboardTabs, { type DashboardTab } from '@/components/dashboard/DashboardTabs'
import MissionTrendPanel from '@/components/dashboard/MissionTrendPanel'
import StatusFeedPanel from '@/components/dashboard/StatusFeedPanel'
import AiInsightsPanel from '@/components/dashboard/AiInsightsPanel'
import AllocationPanel from '@/components/dashboard/AllocationPanel'
import PlannerPanel from '@/components/dashboard/PlannerPanel'
import CropStatusPanel from '@/components/dashboard/CropStatusPanel'
import RewardBreakdownPanel from '@/components/dashboard/RewardBreakdownPanel'
import AlertsPanel from '@/components/dashboard/AlertsPanel'
import CrewPanel from '@/components/dashboard/CrewPanel'
import { useMissionControl } from '@/hooks/useMissionControl'
import styles from './index.module.css'

const MarsBackground = dynamic(() => import('./MarsBackground'), {
  ssr: false,
})

export default function DashboardPage() {
  const {
    health,
    missionSummary,
    selectedSol,
    loading,
    sectionLoading,
    pendingStepCount,
    pendingReset,
    canReset,
    missionComplete,
    error,
    currentRecommendation,
    currentRecommendationLoading,
    currentRecommendationError,
    fetchRecommendationForDay,
    timelinePoints,
    runStep,
    resetMission,
  } = useMissionControl()

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')

  const statusItems = useMemo(() => {
    if (!selectedSol) return []

    return [
      {
        label: 'Mission Feed',
        value: selectedSol.summary,
        tone: 'default' as const,
      },
      {
        label: 'Autonomy',
        value: selectedSol.agent.in_warmup ? 'Warmup phase' : 'Active control loop',
        tone: selectedSol.agent.in_warmup ? ('warning' as const) : ('info' as const),
      },
      {
        label: 'Stress Alerts',
        value:
          selectedSol.stress_alerts.length > 0
            ? `${selectedSol.stress_alerts.length} active anomalies detected`
            : 'No active crop/system stress alerts',
        tone:
          selectedSol.stress_alerts.length > 0 ? ('danger' as const) : ('success' as const),
      },
      {
        label: 'Nutrition',
        value: `${selectedSol.nutrition.calorie_coverage_pct.toFixed(1)}% calorie coverage / ${selectedSol.nutrition.protein_coverage_pct.toFixed(1)}% protein coverage`,
        tone: 'default' as const,
      },
      {
        label: 'Crew',
        value: selectedSol.crew?.crew_critical
          ? 'Crew critical state detected'
          : selectedSol.crew?.any_in_triage
            ? `Triage active for ${selectedSol.crew.triage_astronaut ?? 'one astronaut'}`
            : 'Four astronauts nominal',
        tone: selectedSol.crew?.crew_critical
          ? ('danger' as const)
          : selectedSol.crew?.any_in_triage
            ? ('warning' as const)
            : ('success' as const),
      },
    ]
  }, [selectedSol])

  if (loading) {
    return (
      <>
        <MarsBackground />
        <div className={`${styles.routeShell} relative z-10`}>
          <DashboardShell>
            <div className="grid gap-4 md:gap-5 xl:gap-6">
              <div className="h-16 rounded-[22px] border border-white/10 bg-white/[0.05] animate-pulse" />
              <div className="h-64 rounded-[30px] border border-white/10 bg-white/[0.05] animate-pulse" />
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-40 rounded-[22px] border border-white/10 bg-white/[0.05] animate-pulse"
                  />
                ))}
              </div>
            </div>
          </DashboardShell>
        </div>
      </>
    )
  }

  if (!health || !selectedSol) {
    return (
      <>
        <MarsBackground />
        <div className={`${styles.routeShell} relative z-10`}>
          <DashboardShell>
            <div className="rounded-[26px] border border-red-400/20 bg-red-500/10 p-6 text-red-100 md:p-8">
              {error ?? 'Failed to load dashboard state.'}
            </div>
          </DashboardShell>
        </div>
      </>
    )
  }

  return (
    <>
      <MarsBackground />
      <div className={`${styles.routeShell} relative z-10`}>
        <DashboardShell>
          <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />

          <MissionHeader
            health={health}
            missionSummary={missionSummary}
            selectedSol={selectedSol}
            sectionLoading={sectionLoading}
          />

          <SimulationControls
            missionSummary={missionSummary}
            pendingStepCount={pendingStepCount}
            pendingReset={pendingReset}
            canReset={canReset}
            missionComplete={missionComplete}
            error={error}
            onRun={(count) => void runStep(count)}
            onReset={() => void resetMission()}
          />

          {activeTab === 'overview' && (
            <>
              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.82fr)] 2xl:gap-6">
                <KpiGrid sol={selectedSol} />
                <AiInsightsPanel
                  recommendation={currentRecommendation}
                  loading={currentRecommendationLoading}
                  error={currentRecommendationError}
                  onGenerate={() => void fetchRecommendationForDay(selectedSol.day, true)}
                />
              </div>

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.8fr)] 2xl:gap-6">
                <MissionTrendPanel sol={selectedSol} timelinePoints={timelinePoints} />
                <StatusFeedPanel
                  title="Mission Activity"
                  eyebrow="Live Signals"
                  items={statusItems}
                />
              </div>

              <CrewPanel
                crew={selectedSol.crew}
                missionSummary={missionSummary}
                nutrition={selectedSol.nutrition}
                day={selectedSol.day}
              />

              <div className="grid gap-4 xl:grid-cols-2 2xl:gap-6">
                <AllocationPanel
                  allocation={selectedSol.allocation}
                  proposedAllocation={selectedSol.agent.proposed_allocation}
                  missionAllocation={missionSummary?.current_allocation ?? null}
                  inWarmup={selectedSol.agent.in_warmup}
                />
                <RewardBreakdownPanel reward={selectedSol.reward} agent={selectedSol.agent} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] 2xl:gap-6">
                <PlannerPanel
                  summary={selectedSol.summary}
                  plantingEvents={selectedSol.planting_events}
                  harvestEvents={selectedSol.harvest_events}
                />
                <AlertsPanel alerts={selectedSol.stress_alerts} />
              </div>

              <CropStatusPanel cropStatuses={selectedSol.crop_statuses} />

              <div className="grid gap-4 xl:grid-cols-2 2xl:gap-6">
                <EnvironmentPanel environment={selectedSol.environment} compact />
                <ResourcesPanel resources={selectedSol.resources} compact />
              </div>
            </>
          )}

          {activeTab === 'environment' && (
            <EnvironmentPanel environment={selectedSol.environment} />
          )}

          {activeTab === 'resources' && (
            <ResourcesPanel resources={selectedSol.resources} />
          )}

          {activeTab === 'systems' && (
            <div className="grid gap-4 2xl:gap-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] 2xl:gap-6">
                <MissionTrendPanel sol={selectedSol} timelinePoints={timelinePoints} expanded />
                <StatusFeedPanel
                  title="System Signals"
                  eyebrow="Agent / Stress / Yield"
                  items={[
                    {
                      label: 'Agent Reward',
                      value: `${selectedSol.reward.total.toFixed(3)} current reward`,
                      tone: selectedSol.reward.total < 0 ? 'danger' : 'success',
                    },
                    {
                      label: 'Harvest Ready',
                      value: `${selectedSol.crop_statuses.filter((crop) => crop.ready_to_harvest).length} crop batches ready`,
                      tone: 'success',
                    },
                    {
                      label: 'Stress Alerts',
                      value: `${selectedSol.stress_alerts.length} active issues`,
                      tone: selectedSol.stress_alerts.length > 0 ? 'warning' : 'success',
                    },
                    {
                      label: 'Mission State',
                      value: missionComplete ? 'Mission complete' : 'Simulation window active',
                      tone: missionComplete ? 'warning' : 'info',
                    },
                  ]}
                />
              </div>

              <CrewPanel
                crew={selectedSol.crew}
                missionSummary={missionSummary}
                nutrition={selectedSol.nutrition}
                day={selectedSol.day}
              />

              <div className="grid gap-4 xl:grid-cols-2 2xl:gap-6">
                <AllocationPanel
                  allocation={selectedSol.allocation}
                  proposedAllocation={selectedSol.agent.proposed_allocation}
                  missionAllocation={missionSummary?.current_allocation ?? null}
                  inWarmup={selectedSol.agent.in_warmup}
                />
                <RewardBreakdownPanel reward={selectedSol.reward} agent={selectedSol.agent} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] 2xl:gap-6">
                <PlannerPanel
                  summary={selectedSol.summary}
                  plantingEvents={selectedSol.planting_events}
                  harvestEvents={selectedSol.harvest_events}
                />
                <AlertsPanel alerts={selectedSol.stress_alerts} />
              </div>

              <CropStatusPanel cropStatuses={selectedSol.crop_statuses} />
            </div>
          )}
        </DashboardShell>
      </div>
    </>
  )
}
