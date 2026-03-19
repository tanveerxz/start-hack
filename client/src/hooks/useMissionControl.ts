'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  getClaudeRecommendation,
  getHealth,
  getMissionSummary,
  getSol,
  stepSimulation,
} from '@/lib/api/greenhouse'
import type {
  ClaudeRecommendation,
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
  recommendationsByDay: Record<number, ClaudeRecommendation>
  recommendationsLoadingByDay: Record<number, boolean>
  recommendationsErrorByDay: Record<number, string | null>
  currentRecommendation: ClaudeRecommendation | null
  currentRecommendationLoading: boolean
  currentRecommendationError: string | null
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
  fetchRecommendationForDay: (day: number, force?: boolean) => Promise<void>
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
  const [recommendationsByDay, setRecommendationsByDay] = useState<
    Record<number, ClaudeRecommendation>
  >({})
  const [recommendationsLoadingByDay, setRecommendationsLoadingByDay] = useState<
    Record<number, boolean>
  >({})
  const [recommendationsErrorByDay, setRecommendationsErrorByDay] = useState<
    Record<number, string | null>
  >({})
  const [loading, setLoading] = useState(true)
  const [sectionLoading, setSectionLoading] = useState(false)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [pendingStepCount, setPendingStepCount] = useState<StepSize | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [missionComplete, setMissionComplete] = useState(false)
  const recommendationsByDayRef = useRef<Record<number, ClaudeRecommendation>>({})
  const recommendationsLoadingByDayRef = useRef<Record<number, boolean>>({})

  const fetchRecommendationForDay = useCallback(async (day: number, force = false) => {
    if (!force && recommendationsByDayRef.current[day]) return
    if (recommendationsLoadingByDayRef.current[day]) return

    recommendationsLoadingByDayRef.current = {
      ...recommendationsLoadingByDayRef.current,
      [day]: true,
    }
    setRecommendationsLoadingByDay((prev) => ({ ...prev, [day]: true }))
    setRecommendationsErrorByDay((prev) => ({ ...prev, [day]: null }))

    try {
      const recommendation = await getClaudeRecommendation(day)
      recommendationsByDayRef.current = {
        ...recommendationsByDayRef.current,
        [day]: recommendation,
      }
      setRecommendationsByDay((prev) => ({ ...prev, [day]: recommendation }))
    } catch (err) {
      setRecommendationsErrorByDay((prev) => ({ ...prev, [day]: toMessage(err) }))
    } finally {
      recommendationsLoadingByDayRef.current = {
        ...recommendationsLoadingByDayRef.current,
        [day]: false,
      }
      setRecommendationsLoadingByDay((prev) => ({ ...prev, [day]: false }))
    }
  }, [])

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
      void fetchRecommendationForDay(solRes.day)
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setLoading(false)
    }
  }, [fetchRecommendationForDay])

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
      void fetchRecommendationForDay(liveSol.day)
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setSectionLoading(false)
    }
  }, [fetchRecommendationForDay])

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
      void fetchRecommendationForDay(stepped.day)
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setMissionComplete(true)
      }
      setError(toMessage(err))
    } finally {
      setPendingStepCount(null)
    }
  }, [fetchRecommendationForDay])

  const selectDay = useCallback(
    async (day: number) => {
      setTimelineError(null)
      setSelectedDay(day)

      if (solsByDay[day]) {
        void fetchRecommendationForDay(day)
        return
      }

      setTimelineLoading(true)
      try {
        const sol = await getSol(day)
        setSolsByDay((prev) => ({ ...prev, [day]: sol }))
        void fetchRecommendationForDay(day)
      } catch (err) {
        setTimelineError(toMessage(err))
      } finally {
        setTimelineLoading(false)
      }
    },
    [fetchRecommendationForDay, solsByDay],
  )

  const goToLatest = useCallback(async () => {
    if (!currentSol) return
    await selectDay(currentSol.day)
  }, [currentSol, selectDay])

  const selectedSol = useMemo(() => {
    if (!selectedDay) return currentSol
    return solsByDay[selectedDay] ?? null
  }, [currentSol, selectedDay, solsByDay])

  const recommendationDay = selectedSol?.day ?? selectedDay ?? currentSol?.day ?? null

  const currentRecommendation = useMemo(() => {
    if (!recommendationDay) return null
    return recommendationsByDay[recommendationDay] ?? null
  }, [recommendationDay, recommendationsByDay])

  const currentRecommendationLoading = useMemo(() => {
    if (!recommendationDay) return false
    return recommendationsLoadingByDay[recommendationDay] ?? false
  }, [recommendationDay, recommendationsLoadingByDay])

  const currentRecommendationError = useMemo(() => {
    if (!recommendationDay) return null
    return recommendationsErrorByDay[recommendationDay] ?? null
  }, [recommendationDay, recommendationsErrorByDay])

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
    recommendationsByDay,
    recommendationsLoadingByDay,
    recommendationsErrorByDay,
    currentRecommendation,
    currentRecommendationLoading,
    currentRecommendationError,
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
    fetchRecommendationForDay,
    timelinePoints,
  }
}
