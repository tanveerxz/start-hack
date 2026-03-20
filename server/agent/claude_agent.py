import os
import json
import logging
from pathlib import Path
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")


def _fallback_response() -> dict:
    return {
        "status_summary": "AI summary unavailable.",
        "critical_issues": [],
        "recommendations": [
            "Inspect live resource and stress panels for the current sol.",
            "Use planner and allocation panels to review the agent's latest actions.",
        ],
        "outlook": "Fallback guidance active because the Anthropic service is unavailable.",
        "crew_risk_level": "unknown",
    }


def _get_client() -> Anthropic | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY is not configured; using fallback AI response.")
        return None
    return Anthropic(api_key=api_key)

def get_ai_summary(sol_payload: dict) -> dict:
    trimmed = {
        "mission_day": sol_payload.get("mission_day"),
        "days_remaining": sol_payload.get("days_remaining"),
        "summary": sol_payload.get("summary"),
        "nutrition": sol_payload.get("nutrition"),
        "resources": sol_payload.get("resources"),
        "reward": {
            "total": sol_payload.get("reward", {}).get("total"),
            "nutrition_note": sol_payload.get("reward", {}).get("nutrition_note"),
            "efficiency_note": sol_payload.get("reward", {}).get("efficiency_note"),
            "stress_note": sol_payload.get("reward", {}).get("stress_note"),
            "critical_note": sol_payload.get("reward", {}).get("critical_note"),
        },
        "stress_alerts": sol_payload.get("stress_alerts", []),
    }

    prompt = f"""You are ARIA, the autonomous AI controller of a Martian greenhouse on Sol {trimmed.get('mission_day', '?')} of a 450-sol mission feeding 4 astronauts.

Given this mission state, respond ONLY with valid JSON — no markdown, no preamble, just the JSON object.

Required keys:
- "status_summary": one sentence describing mission status right now
- "critical_issues": list of strings, each a critical problem (empty list if none)
- "recommendations": list of 2-3 actionable strings the crew should act on today
- "outlook": one sentence predicting the next 10 sols
- "crew_risk_level": one of "low", "medium", "high"

    Mission state:
{json.dumps(trimmed, indent=2)}"""

    try:
        client = _get_client()
        if client is None:
            return _fallback_response()

        response = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text.strip()

        # Strip markdown fences if Claude adds them
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        parsed = json.loads(text)
        return {
            "status_summary": parsed.get("status_summary", "AI summary unavailable."),
            "critical_issues": parsed.get("critical_issues", []),
            "recommendations": parsed.get("recommendations", []),
            "outlook": parsed.get("outlook", "Unable to generate outlook."),
            "crew_risk_level": parsed.get("crew_risk_level", "unknown"),
        }

    except json.JSONDecodeError as e:
        logger.error("Claude returned invalid JSON: %s", e)
        return _fallback_response()
    except Exception as e:
        logger.error("Claude API error: %s", e)
        return _fallback_response()
