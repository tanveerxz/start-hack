import os
import json
import logging
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_client() -> Anthropic | None:
    raw = os.getenv("ANTHROPIC_API_KEY")

    if raw is None:
        logger.error("ANTHROPIC_API_KEY is missing")
        return None

    key = raw.strip()

    logger.info("KEY RAW: %r", key[:20])
    logger.info("KEY LEN: %d", len(key))
    logger.info("STARTS WITH sk-ant: %s", key.startswith("sk-ant-"))
    logger.info("FIRST CHAR: %r", key[:1])

    return Anthropic(api_key=key)

def fallback_response() -> dict:
    return {
        "status_summary": "AI summary unavailable.",
        "critical_issues": [],
        "recommendations": [],
        "outlook": "Unable to generate outlook.",
        "crew_risk_level": "unknown"
    }

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
        client = get_client()
        if client is None:
            return fallback_response()

        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )

        text = response.content[0].text.strip()

        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        return json.loads(text)

    except json.JSONDecodeError as e:
        logger.error("Claude returned invalid JSON: %s", e)
        return fallback_response()
    except Exception:
        logger.exception("Claude API error")
        return fallback_response()