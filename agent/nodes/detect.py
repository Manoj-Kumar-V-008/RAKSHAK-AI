"""
Node 1 — detect_crisis
Classifies the raw sensor payload and computes initial threat score.
"""
import json
import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

from ..state import CrisisState
from ..tools.scoring import compute_threat_score, compute_cascade_risk

_llm: ChatGoogleGenerativeAI | None = None


def _get_llm() -> ChatGoogleGenerativeAI:
    global _llm
    if _llm is None:
        _llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=os.getenv("GEMINI_API_KEY", ""),
            temperature=0.1,
        )
    return _llm


async def detect_crisis(state: CrisisState) -> dict:
    sensor = state["sensor_data"]

    prompt = f"""You are RAKSHAK AI — a crisis detection engine. Analyze this IoT sensor payload
and return ONLY a raw JSON object (no markdown, no backticks).

Sensor payload: {json.dumps(sensor)}

Return exactly this structure:
{{
  "crisis_type": "<one of: smoke, fire, health, cardiac, security, breach, power, water>",
  "severity": <integer 1-10>,
  "sensor_anomaly_score": <float 0-100>,
  "location_name": "<clean location string>",
  "initial_assessment": "<2 sentence assessment>"
}}"""

    try:
        resp    = _get_llm().invoke([HumanMessage(content=prompt)])
        content = resp.content.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        detected = json.loads(content)
    except Exception:
        detected = {
            "crisis_type":         sensor.get("type", "smoke"),
            "severity":            7,
            "sensor_anomaly_score": float(sensor.get("value", 82)),
            "location_name":       sensor.get("location", "Unknown location"),
            "initial_assessment":  f"Anomaly detected: {sensor.get('type', 'unknown')} event.",
        }

    crisis_type    = str(detected.get("crisis_type", "smoke"))
    severity       = int(detected.get("severity", 7))
    anomaly_score  = float(detected.get("sensor_anomaly_score", 80))

    cascade_risk              = compute_cascade_risk(severity, crisis_type)
    threat_score, threat_level = compute_threat_score(
        sensor_value=anomaly_score,
        crisis_type=crisis_type,
        available_services_ratio=0.8,   # refined after gather_intel
        cascade_risk=cascade_risk,
    )

    log = {
        "node":         "detect_crisis",
        "summary":      f"Type: {crisis_type.upper()} | Severity: {severity}/10 | ThreatScore: {threat_score} ({threat_level})",
        "data":         detected,
        "threat_score": threat_score,
        "threat_level": threat_level,
    }

    return {
        "crisis_type":   crisis_type,
        "severity":      severity,
        "location_name": str(detected.get("location_name", sensor.get("location", "Unknown"))),
        "threat_score":  threat_score,
        "threat_level":  threat_level,
        "cascade_risk":  cascade_risk,
        "agent_log":     state.get("agent_log", []) + [log],
    }
