'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  getHealth,
  getMissionSummary,
  getSol,
  stepSimulation,
} from '@/lib/api/greenhouse'
import type {
  DailyResponse,
  HealthResponse,
  MissionSummary,
  StepSize,
  TimelinePoint,
} from '@/types/greenhouse'

interface MissionControlState {
  health: HealthResponse | null
  missionSummary: MissionSummary | null
  currentSol: DailyResponse | null
  selectedDay: number | null
  selectedSol: DailyResponse | null
  solsByDay: Record<number, DailyResponse>
  loading: boolean
  sectionLoading: boolean
  timelineLoading: boolean
  pendingStepCount: StepSize | null
  error: string | null
  timelineError: string | null
  missionComplete: boolean
  runStep: (count: StepSize) => Promise<void>
  selectDay: (day: number) => Promise<void>
  refresh: () => Promise<void>
  goToLatest: () => Promise<void>
  timelinePoints: TimelinePoint[]
}

function toMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

export function useMissionControl(): MissionControlState {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [missionSummary, setMissionSummary] = useState<MissionSummary | null>(null)
  const [currentSol, setCurrentSol] = useState<DailyResponse | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [solsByDay, setSolsByDay] = useState<Record<number, DailyResponse>>({})
  const [loading, setLoading] = useState(true)
  const [sectionLoading, setSectionLoading] = useState(false)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [pendingStepCount, setPendingStepCount] = useState<StepSize | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [missionComplete, setMissionComplete] = useState(false)

  const bootstrap = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const healthRes = await getHealth()
      const summaryRes = await getMissionSummary()
      const solRes = await getSol(healthRes.sol)

      setHealth(healthRes)
      setMissionSummary(summaryRes)
      setCurrentSol(solRes)
      setSelectedDay(solRes.day)
      setSolsByDay({ [solRes.day]: solRes })
      setMissionComplete(solRes.days_remaining <= 0)
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const refresh = useCallback(async () => {
    setSectionLoading(true)
    setError(null)

    try {
      const healthRes = await getHealth()
      const summaryRes = await getMissionSummary()
      const liveSol = await getSol(healthRes.sol)

      setHealth(healthRes)
      setMissionSummary(summaryRes)
      setCurrentSol(liveSol)
      setSelectedDay(liveSol.day)
      setSolsByDay((prev) => ({ ...prev, [liveSol.day]: liveSol }))
      setMissionComplete(liveSol.days_remaining <= 0)
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setSectionLoading(false)
    }
  }, [])

  const runStep = useCallback(async (count: StepSize) => {
    setPendingStepCount(count)
    setError(null)

    try {
      const stepped = await stepSimulation({ n_sols: count })
      const [healthRes, summaryRes] = await Promise.all([getHealth(), getMissionSummary()])

      setCurrentSol(stepped)
      setHealth(healthRes)
      setMissionSummary(summaryRes)
      setSelectedDay(stepped.day)
      setSolsByDay((prev) => ({ ...prev, [stepped.day]: stepped }))
      setMissionComplete(stepped.days_remaining <= 0)
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setMissionComplete(true)
      }
      setError(toMessage(err))
    } finally {
      setPendingStepCount(null)
    }
  }, [])

  const selectDay = useCallback(
    async (day: number) => {
      setTimelineError(null)
      setSelectedDay(day)

      if (solsByDay[day]) return

      setTimelineLoading(true)
      try {
        const sol = await getSol(day)
        setSolsByDay((prev) => ({ ...prev, [day]: sol }))
      } catch (err) {
        setTimelineError(toMessage(err))
      } finally {
        setTimelineLoading(false)
      }
    },
    [solsByDay],
  )

  const goToLatest = useCallback(async () => {
    if (!currentSol) return
    await selectDay(currentSol.day)
  }, [currentSol, selectDay])

  const selectedSol = useMemo(() => {
    if (!selectedDay) return currentSol
    return solsByDay[selectedDay] ?? null
  }, [currentSol, selectedDay, solsByDay])

  const timelinePoints = useMemo(() => {
    return Object.values(solsByDay)
      .sort((a, b) => a.day - b.day)
      .map((sol) => ({
        day: sol.day,
        reward: sol.reward.total,
        calorieCoveragePct: sol.nutrition.calorie_coverage_pct,
        proteinCoveragePct: sol.nutrition.protein_coverage_pct,
        recyclingRatioPct: sol.resources.recycling_ratio,
        waterAvailable: sol.resources.water_available_liters,
        anyCritical: sol.resources.any_critical,
      }))
  }, [solsByDay])

  return {
    health,
    missionSummary,
    currentSol,
    selectedDay,
    selectedSol,
    solsByDay,
    loading,
    sectionLoading,
    timelineLoading,
    pendingStepCount,
    error,
    timelineError,
    missionComplete,
    runStep,
    selectDay,
    refresh,
    goToLatest,
    timelinePoints,
  }
}