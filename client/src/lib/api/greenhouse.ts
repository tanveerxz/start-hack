import type {
  DailyResponse,
  HealthResponse,
  MissionSummary,
  StepRequest,
} from '@/types/greenhouse'

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    let details: unknown = null

    try {
      details = await res.json()
    } catch {
      details = await res.text().catch(() => null)
    }

    const fallback =
      res.status === 400
        ? 'Mission cannot advance further.'
        : res.status === 404
          ? 'Requested mission data was not found.'
          : res.status === 422
            ? 'Invalid simulation request.'
            : 'Backend request failed.'

    throw new ApiError(fallback, res.status, details)
  }

  return res.json() as Promise<T>
}

export function getHealth() {
  return request<HealthResponse>('/api/health')
}

export function getMissionSummary() {
  return request<MissionSummary>('/api/mission/summary')
}

export function getSol(day: number) {
  return request<DailyResponse>(`/api/sol/${day}`)
}

export function stepSimulation(payload: StepRequest) {
  return request<DailyResponse>('/api/step', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}