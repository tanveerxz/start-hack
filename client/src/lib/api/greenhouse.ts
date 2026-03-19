import type {
  ClaudeRecommendation,
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

function normalizeRecommendation(
  payload: Partial<ClaudeRecommendation> & {
    recommendations?: string[]
    critical_issues?: string[]
  },
  day: number,
): ClaudeRecommendation {
  if (Array.isArray(payload.next_steps)) {
    return {
      generated_for_day: payload.generated_for_day ?? day,
      status_summary: payload.status_summary ?? 'AI summary unavailable.',
      next_steps: payload.next_steps,
      warnings: payload.warnings ?? [],
      outlook: payload.outlook ?? 'No outlook available.',
      crew_risk_level: payload.crew_risk_level ?? 'unknown',
      confidence: payload.confidence ?? null,
      is_fallback: payload.is_fallback ?? false,
    }
  }

  return {
    generated_for_day: day,
    status_summary: payload.status_summary ?? 'AI summary unavailable.',
    next_steps: (payload.recommendations ?? []).map((action, index) => ({
      id: `${day}-${index + 1}`,
      action,
      priority: 'medium',
      rationale: 'Derived from the current AI guidance payload.',
    })),
    warnings: payload.warnings ?? payload.critical_issues ?? [],
    outlook: payload.outlook ?? 'No outlook available.',
    crew_risk_level: payload.crew_risk_level ?? 'unknown',
    confidence: payload.confidence ?? null,
    is_fallback: payload.is_fallback ?? false,
  }
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

export function getClaudeRecommendation(day: number) {
  // Backend currently exposes /api/ai-summary; the day query keeps the client
  // aligned with the expected per-sol contract once the server uses it.
  return request<Partial<ClaudeRecommendation>>(
    `/api/ai-summary?day=${encodeURIComponent(day)}`,
  ).then((payload) => normalizeRecommendation(payload, day))
}
