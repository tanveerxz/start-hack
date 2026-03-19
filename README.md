# Ares Harvest

Full-stack Mars greenhouse simulation project with:

- a Next.js frontend for the landing experience and mission dashboard
- a FastAPI backend that runs a 450-sol greenhouse simulation
- local project metadata for Kiro MCP

This README describes the repository as it currently exists in `C:\Users\kappo\Desktop\start-hack`.

## 1. Top-Level Filesystem

```text
start-hack/
├─ .kiro/
│  └─ settings/
│     └─ mcp.json
├─ client/
├─ server/
├─ .gitignore
└─ README.md
```

Notes:

- `.kiro/settings/mcp.json` configures a remote MCP server called `mars-crop-knowledge-base`.
- Backend environment variables should be stored in `server/.env`.

## 2. Project Purpose

The project simulates a Mars greenhouse mission that must feed 4 astronauts over 450 sols. The backend models environment, crop growth, resources, planning, reward scoring, and RL adaptation. The frontend renders:

- a cinematic landing page with a 3D Mars model
- a dashboard for mission control
- simulation controls for advancing the mission
- panels for mission health, trends, environment, resources, status signals, and AI insights

## 3. Root-Level Files

### `.gitignore`

Repository ignore rules for local/runtime files.

### `README.md`

This document.

## 4. Hidden Tooling Directories

### `.kiro/settings/mcp.json`

Contains:

- one MCP server entry
- name: `mars-crop-knowledge-base`
- type: `streamableHttp`
- remote Bedrock AgentCore gateway URL

This is tooling metadata, not application runtime code.

## 5. Frontend (`client/`)

### Frontend Overview

The frontend is a Next.js 15 App Router project using:

- `react` 19
- `next` 15.3
- `tailwindcss` 4
- `three`, `@react-three/fiber`, `@react-three/drei`
- `gsap`
- `recharts` is installed, but the current dashboard trend panel is implemented with a custom SVG component rather than Recharts

### Frontend Root Files

- `client/package.json`
  - app name: `ares-harvest`
  - scripts: `dev`, `build`, `start`, `lint`
- `client/package-lock.json`
  - npm lockfile
- `client/tsconfig.json`
  - TypeScript project config
- `client/tsconfig.tsbuildinfo`
  - TypeScript incremental build artifact
- `client/next.config.ts`
  - Next.js config
- `client/next-env.d.ts`
  - generated Next.js type declarations
- `client/postcss.config.mjs`
  - PostCSS/Tailwind integration
- `client/README.md`
  - default Create Next App README; not project-specific

### Frontend Public Assets

- `client/public/models/mars.glb`
  - 3D Mars model used by the landing page scene

### Frontend App Router

#### `client/src/app/layout.tsx`

Global app layout wrapper.

#### `client/src/app/globals.css`

Global styles for the app.

#### `client/src/app/not-found.tsx`

404 page.

#### `client/src/app/page.tsx`

Landing page entry point.

Responsibilities:

- dynamically loads `MarsScene`
- renders `HeroOverlay`
- uses `useScrollProgress` to drive story state and camera motion

#### `client/src/app/landing.module.css`

Landing-page specific styling for the cinematic story and HUD overlays.

### Dashboard Route

#### `client/src/app/dashboard/page.tsx`

Main mission dashboard page.

Responsibilities:

- consumes `useMissionControl()`
- renders mission header, controls, KPI grid, trend panel, status feed, AI insights, environment, and resources
- manages tab switching between `overview`, `environment`, `resources`, and `systems`

#### `client/src/app/dashboard/index.module.css`

Dashboard route-level styling.

#### `client/src/app/dashboard/MarsBackground.tsx`

Dashboard background visual layer.

## 6. Frontend Hooks

### `client/src/hooks/useScrollProgress.ts`

Landing-page hook.

Responsibilities:

- tracks scroll progress
- tracks mouse movement
- exposes `scrollTo(...)` helper for story progression

### `client/src/hooks/useMissionControl.ts`

Primary dashboard state hook.

Responsibilities:

- bootstraps the initial mission state from the backend
- stores:
  - `health`
  - `missionSummary`
  - `currentSol`
  - `selectedDay`
  - `selectedSol`
  - `solsByDay`
  - recommendation cache by day
  - loading/error state
- exposes:
  - `runStep(count)`
  - `selectDay(day)`
  - `refresh()`
  - `goToLatest()`
  - `fetchRecommendationForDay(day, force?)`
  - `timelinePoints`

Important current behavior:

- AI insights are manual, not automatically generated after each step
- `timelinePoints` are built from the locally cached sols
- historical day selection infrastructure exists in the hook, but the current dashboard does not expose a separate explicit timeline scrubber control

## 7. Frontend API Layer

### `client/src/lib/api/greenhouse.ts`

Typed frontend API client for the FastAPI server.

Uses:

- `NEXT_PUBLIC_API_BASE_URL`
- fallback base URL: `http://localhost:8000`

Exports:

- `ApiError`
- `getHealth()`
- `getMissionSummary()`
- `getSol(day)`
- `stepSimulation(payload)`
- `getClaudeRecommendation(day)`

## 8. Frontend Shared Types

### `client/src/types/greenhouse.ts`

Defines the main TypeScript contracts used throughout the frontend.

Includes:

- `HealthResponse`
- `Allocation`
- `EnvironmentData`
- `NutritionData`
- `ResourceData`
- `RewardData`
- `AgentData`
- `PlantingEvent`
- `StressAlert`
- `CropStatus`
- `DailyResponse`
- `MissionSummary`
- `StepRequest`
- `TimelinePoint`
- `StepSize`

Current detail:

- `StepSize` is currently `number` on the client to allow custom whole-number manual step counts

## 9. Frontend Components

### Landing Components

#### `client/src/components/MarsScene.tsx`

Three.js/R3F landing scene.

Contains:

- star layers
- atmospheric sprites and dust haze
- orbital ring
- habitat farm model
- GLB Mars model loader
- landing-page lighting and fog

Current detail:

- the GLB scene is cloned and its materials/textures are refreshed on mount to reduce intermittent texture-missing first loads

#### `client/src/components/CameraRig.tsx`

Landing-page camera choreography based on scroll progress and mouse motion.

#### `client/src/components/HeroOverlay.tsx`

Landing-page storytelling overlay with:

- phased mission narrative
- CTA progression
- HUD-style text and status

### Dashboard Components

#### `client/src/components/dashboard/DashboardShell.tsx`

Outer dashboard layout container.

#### `client/src/components/dashboard/DashboardTabs.tsx`

Top navigation tabs for dashboard sections.

#### `client/src/components/dashboard/MissionHeader.tsx`

Mission header card.

Shows:

- mission title
- selected sol summary
- current sol
- sols remaining
- mission status

Current detail:

- header stat pills use upward-opening tooltips via `InfoTooltip`

#### `client/src/components/dashboard/SimulationControls.tsx`

Simulation step controls.

Features:

- quick step buttons: `1`, `10`, `50`
- custom whole-number manual step input
- input validation capped at `50`
- run button for arbitrary valid manual step count

#### `client/src/components/dashboard/KpiGrid.tsx`

Top-level KPI cards.

Shows:

- Reward
- Calorie Coverage
- Protein Coverage
- Recycling Ratio
- Total Yield
- Stress Alerts
- Harvest Ready
- Autonomy Mode

Current detail:

- each KPI card has a hover tooltip explaining the metric

#### `client/src/components/dashboard/MissionTrendPanel.tsx`

Interactive mission trend chart.

Current behavior:

- uses real `timelinePoints` when multiple sols are cached
- falls back to synthetic trend data when history is insufficient
- tracks hover/focus on 12 chart segments
- shows hover tooltip with:
  - sol number
  - reward
  - calorie coverage
  - protein coverage
  - recycling
  - critical/stable state

#### `client/src/components/dashboard/StatusFeedPanel.tsx`

Structured status feed card for short operational signals.

Current detail:

- feed entries use hover tooltips showing expanded label/value text

#### `client/src/components/dashboard/AiInsightsPanel.tsx`

Manual recommendation panel.

Features:

- manual “Generate AI Insights” / “Regenerate Insights” button
- loading, error, and empty states
- status summary
- crew risk level
- warnings
- next steps
- outlook

#### `client/src/components/dashboard/EnvironmentPanel.tsx`

Environment metrics card.

Shows:

- temperature
- humidity
- CO2
- PAR
- pH
- EC
- water reserve
- power reserve

Current detail:

- each metric card has a hover tooltip

#### `client/src/components/dashboard/ResourcesPanel.tsx`

Resource metrics card.

Shows:

- water available/consumed/recycled/extracted
- recycling ratio
- stock remaining
- nutrient concentrations

Current detail:

- major cards and metric groups use hover tooltips

#### `client/src/components/dashboard/InfoTooltip.tsx`

Reusable tooltip wrapper.

Supports:

- `content`
- `children`
- `position="top" | "bottom"`

Used across dashboard cards.

## 10. Backend (`server/`)

### Backend Overview

The backend is a FastAPI app that simulates the greenhouse and exposes JSON endpoints for the dashboard.

### Backend Root Files

- `server/main.py`
  - backend entry point and route definitions
- `server/requirements.txt`
  - currently lists only:
    - `fastapi`
    - `uvicorn`
    - `pydantic`
- `server/test_suite.py`
  - HTTP-based smoke/integration-style test script
- `server/test.ts`
  - empty file
- `server/.env`
  - local runtime env file present in the current filesystem
- `server/venv/`
  - local Python virtual environment directory
- `server/__pycache__/`
  - Python bytecode cache

Important precision note:

- The code imports `dotenv`, but `server/requirements.txt` does not currently declare it.

## 11. Backend Route Layer

### `server/main.py`

Core backend orchestrator.

Responsibilities:

- initializes mission-wide singleton state
- seeds sol history on startup
- runs the sol pipeline
- exposes FastAPI endpoints

Main routes:

- `POST /api/step`
  - advances the simulation by `n_sols`
  - returns only the final sol payload
- `GET /api/sol/{day}`
  - returns a stored sol payload
- `GET /api/mission/summary`
  - returns cumulative mission metrics
- `GET /api/health`
  - returns liveness and current sol info

## 12. Backend Schemas

### `server/api/__init__.py`

Package marker.

### `server/api/schemas.py`

Pydantic response and request schema layer.

Defines:

- environment schema
- allocation schema
- planting events
- crop statuses
- stress alerts
- resources
- reward
- agent
- nutrition
- `DailyResponseSchema`
- `MissionSummarySchema`
- `SimStepRequestSchema`

Also provides:

- `build_daily_response(...)`
- `build_mission_summary(...)`

## 13. Backend Simulation Modules

### `server/environment/__init__.py`

Package marker.

### `server/environment/martian.py`

Mars greenhouse environment simulation.

Responsibilities:

- initializes greenhouse state
- simulates atmospheric/climate drift and control conditions per sol

### `server/environment/crops.py`

Crop growth and stress simulation.

Responsibilities:

- simulates crop growth
- tracks crop statuses
- detects stress conditions
- produces stress alerts and recommended corrective actions

### `server/environment/resources.py`

Closed-loop resource model.

Responsibilities:

- water consumption/recovery
- extraction
- nutrient dosing/stock tracking
- pH/EC updates
- critical-state flags

## 14. Backend Agent Modules

### `server/agent/__init__.py`

Package marker.

### `server/agent/models.py`

Core simulation dataclasses and domain models.

Includes:

- crop types
- environment types
- schedule/event types
- allocation and crew requirement models

### `server/agent/planner.py`

Deterministic planning logic.

Responsibilities:

- assess needs
- allocate greenhouse area
- schedule planting/harvest
- respond to stress conditions

### `server/agent/reward.py`

Reward computation for the RL controller.

Combines:

- nutrition
- efficiency
- stress
- critical-state penalties

### `server/agent/rl_agent.py`

Reinforcement-learning policy implementation.

Responsibilities:

- observe current state
- propose area allocation overrides
- update policy from reward
- persist/load checkpoints

## 15. Backend Data / Runtime State

### `server/data/agent_checkpoint.json`

Persisted RL agent checkpoint.

This is runtime/generated mission state, not source code.

## 16. Backend Test Files

### `server/test_suite.py`

Simple Python HTTP test runner against a live backend.

Covers:

- health check
- sol retrieval
- stepping simulation
- harvest milestones
- mission summary
- reward validity

### `server/test.ts`

Empty file. Currently unused.

## 17. API and Data Flow

### Dashboard Data Flow

1. Frontend `useMissionControl()` calls `getHealth()`
2. Frontend calls `getMissionSummary()`
3. Frontend calls `getSol(health.sol)`
4. Dashboard renders selected/current sol
5. User triggers `runStep(count)`
6. Frontend calls `POST /api/step`
7. Backend runs `run_one_sol()` for each requested sol
8. Backend returns the final `DailyResponse`
9. Frontend updates current sol, summary, and timeline cache

## 18. Environment and Runtime Expectations

### Frontend Env

- `NEXT_PUBLIC_API_BASE_URL`
  - optional
  - defaults to `http://localhost:8000`

### Backend Env

- backend environment variables should be stored in `server/.env`

## 19. Known Repository Caveats

- `client/README.md` is still the default Next.js scaffold README.
- `README.md` did not exist before this file was added.
- `server/requirements.txt` is incomplete relative to actual imports.
- `server/test.ts` is empty.
- `server/venv/` and `server/__pycache__/` are local/runtime directories currently present in the repository tree.

## 20. Suggested Run Commands

### Frontend

```bash
cd client
npm install
npm run dev
```

### Backend

```bash
cd server
uvicorn main:app --reload --port 8000
```

### Type Check Frontend

```bash
cd client
npx tsc --noEmit
```

### Backend Smoke Tests

Run against a live backend:

```bash
cd server
python test_suite.py
```
