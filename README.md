<div align="center">

# ARES HARVEST

### Autonomous Martian Greenhouse · START HACK 2026

*Feeding 4 astronauts across 450 sols on the surface of Mars*

![Next.js](https://img.shields.io/badge/Next.js_15-black?style=for-the-badge&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Claude](https://img.shields.io/badge/Claude_AI-D97757?style=for-the-badge&logo=anthropic&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js)

<img width="1512" alt="Ares Harvest Dashboard" src="https://github.com/user-attachments/assets/6ef5f242-41b7-4e4d-b647-d3d274a224f6" />

</div>


A reinforcement learning agent autonomously manages a pressurised Martian greenhouse: optimising crop allocation, recycling resources, and adapting to dust storms in real time. Mission control is rendered as a cinematic 3D dashboard.



## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind 4, Three.js, GSAP |
| Backend | FastAPI, Python 3.12 |
| AI | Custom RL agent + Anthropic Claude (ARIA) |
| Simulation | 450-sol Mars greenhouse model |

---

## Quickstart

**Prerequisites:** Node.js 18+, Python 3.12, [Miniconda](https://www.anaconda.com/docs/getting-started/miniconda/main)
```bash
git clone https://github.com/tanveerxz/start-hack.git
cd start-hack
```

**Frontend**
```bash
cd client
npm install
npm run dev
```

**Backend**
```bash
cd server
conda create -n mars-hack python=3.12 -y
conda activate mars-hack
pip install -r requirements.txt
pip install anthropic python-dotenv
python -m uvicorn main:app --reload --port 8000
```

**Environment**

Create `server/.env` — contact a team member for the key:
```
ANTHROPIC_API_KEY=your-key-here
```
The app runs fully without it. The AI insights panel will show a fallback response.

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/step` | Advance simulation by N sols |
| `GET` | `/api/sol/{day}` | Retrieve a stored sol payload |
| `GET` | `/api/mission/summary` | Mission-wide totals and averages |
| `GET` | `/api/ai-summary` | ARIA — Claude mission narrative |
| `GET` | `/api/health` | Liveness check |

Swagger UI → `http://localhost:8000/docs`

---

## Structure
```
start-hack/
├── client/                 # Next.js frontend
│   └── src/
│       ├── app/            # Pages and routes
│       ├── components/     # Dashboard and landing components
│       ├── hooks/          # useMissionControl, useScrollProgress
│       └── lib/api/        # Typed API client
└── server/                 # FastAPI backend
    ├── agent/              # RL agent, planner, reward, ARIA
    ├── api/                # Pydantic schemas
    ├── environment/        # Mars sim, crop growth, resources
    └── main.py             # Entrypoint
```

---

<div align="center">

Built at **START HACK 2026** · Syngenta × AWS challenge

St. Gallen, Switzerland

</div>
