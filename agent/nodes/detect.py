import re

from ..llm import AgentLLMError, generate_text
from ..state import CrisisState


VALID_CRISIS_TYPES = {
    "smoke",
    "fire",
    "health",
    "cardiac",
    "security",
    "breach",
    "power",
    "water",
}


def _normalize_crisis_type(sensor: dict) -> str:
    raw_type = str(sensor.get("type", "unknown")).strip().lower()
    alert = str(sensor.get("alert", "")).strip().lower()

    if "cardiac" in alert or sensor.get("heart_rate") == 0:
        return "cardiac"
    if "breach" in alert:
        return "breach"
    if raw_type in VALID_CRISIS_TYPES:
        return raw_type
    if "medical" in alert:
        return "health"
    return "security" if raw_type == "unknown" and alert else raw_type or "security"


def _estimate_severity(crisis_type: str, sensor: dict) -> int:
    value = float(sensor.get("value", 0) or 0)
    temperature = float(sensor.get("temperature_c", 0) or 0)
    heart_rate = float(sensor.get("heart_rate", 0) or 0)
    spo2 = float(sensor.get("spo2", 100) or 100)

    if crisis_type == "cardiac":
        if heart_rate <= 0:
            return 10
        if spo2 < 70:
            return 9
        return 8

    if crisis_type == "health":
        if spo2 < 75:
            return 9
        if spo2 < 88:
            return 8
        return 6

    if crisis_type in {"smoke", "fire"}:
        severity = 4
        if value >= 90:
            severity += 3
        elif value >= 75:
            severity += 2
        elif value >= 60:
            severity += 1
        if temperature >= 300:
            severity += 2
        elif temperature >= 180:
            severity += 1
        return min(severity, 10)

    if crisis_type in {"security", "breach"}:
        if value >= 90:
            return 8
        if value >= 70:
            return 7
        return 6

    if crisis_type == "water":
        if value >= 85:
            return 8
        if value >= 65:
            return 7
        return 5

    if crisis_type == "power":
        return 7 if value <= 5 else 5

    return 6


def _fallback_detection(sensor: dict) -> dict:
    crisis_type = _normalize_crisis_type(sensor)
    severity = _estimate_severity(crisis_type, sensor)
    location = sensor.get("location", "Unknown")
    sensor_id = sensor.get("sensor_id", "UNKNOWN")

    analysis = (
        f"Sensor {sensor_id} indicates a {crisis_type} incident at {location}. "
        f"Telemetry shows elevated risk markers, so the event is treated as severity {severity}/10."
    )
    steps = [
        f"Read telemetry for sensor {sensor_id} at {location}.",
        f"Mapped incoming event fields to crisis type {crisis_type}.",
        f"Estimated severity from sensor values and escalation thresholds.",
    ]

    return {
        "crisis_type": crisis_type,
        "severity": severity,
        "analysis": analysis,
        "steps": steps,
    }


def _parse_detection_response(text: str, fallback: dict) -> dict:
    crisis_type = fallback["crisis_type"]
    severity = fallback["severity"]
    analysis = fallback["analysis"]
    steps: list[str] = []

    for line in text.splitlines():
        line_s = line.strip()
        if not line_s:
            continue
        if line_s.startswith("CRISIS_TYPE:"):
            candidate = line_s.split(":", 1)[1].strip().lower()
            if candidate in VALID_CRISIS_TYPES:
                crisis_type = candidate
        elif line_s.startswith("SEVERITY:"):
            try:
                severity = max(1, min(10, int(line_s.split(":", 1)[1].strip())))
            except ValueError:
                pass
        elif line_s.startswith("ANALYSIS:"):
            parsed = line_s.split(":", 1)[1].strip()
            if parsed:
                analysis = parsed
        elif re.match(r"^\d+\.\s+", line_s):
            steps.append(line_s.split(".", 1)[1].strip())

    return {
        "crisis_type": crisis_type,
        "severity": severity,
        "analysis": analysis,
        "steps": steps or fallback["steps"],
    }


def detect_crisis(state: CrisisState) -> dict:
    """
    Node 1 - DETECT: classify the sensor anomaly, assign severity,
    and build a reasoning trace.
    """
    sensor = state.get("sensor_data", {})
    sensor_type = sensor.get("type", "unknown")
    sensor_value = sensor.get("value", 0)
    location = sensor.get("location", "Unknown")
    fallback = _fallback_detection(sensor)

    prompt = f"""You are RAKSHAK AI, a crisis-detection engine.

Sensor telemetry received:
  Type:     {sensor_type}
  Value:    {sensor_value}
  Location: {location}
  Extra:    {sensor}

TASK: Classify this event and determine severity.

FORMAT YOUR RESPONSE EXACTLY like this:
CRISIS_TYPE: <one of: smoke, fire, health, cardiac, security, breach, power, water>
SEVERITY: <integer 1-10>
ANALYSIS: <2-3 sentence explanation>
REASONING_STEPS:
1. <first reasoning step>
2. <second reasoning step>
3. <third reasoning step>

Be analytical and reference the provided sensor values and likely operational risk.
"""

    try:
        parsed = _parse_detection_response(
            generate_text(prompt, task_name="detect_crisis"),
            fallback,
        )
    except AgentLLMError as exc:
        parsed = {
            **fallback,
            "analysis": f"{fallback['analysis']} AI model fallback engaged because: {exc}",
        }

    crisis_type = parsed["crisis_type"]
    severity = parsed["severity"]
    analysis = parsed["analysis"]
    steps = parsed["steps"]

    chain_of_thought = state.get("chain_of_thought", [])
    chain_of_thought.append({
        "node": "detect_crisis",
        "text": (
            f"Sensor {sensor.get('sensor_id', 'UNKNOWN')} anomaly detected. "
            f"Type: {crisis_type.upper()}, Value: {sensor_value}, Location: {location}."
        ),
        "factors": [
            f"Sensor value: {sensor_value}",
            f"Crisis type: {crisis_type}",
            f"Location: {location}",
        ],
    })

    for step in steps:
        chain_of_thought.append({
            "node": "detect_crisis",
            "text": step,
        })

    chain_of_thought.append({
        "node": "detect_crisis",
        "text": f"Classification complete: {crisis_type.upper()}, Severity: {severity}/10. {analysis}",
        "factors": [
            f"Severity: {severity}/10",
            f"Analysis: {analysis[:120]}",
        ],
    })

    log = {
        "node": "detect_crisis",
        "summary": f"{crisis_type.upper()} classified at severity {severity}/10.",
        "data": {
            "crisis_type": crisis_type,
            "severity": severity,
            "analysis": analysis,
        },
    }

    return {
        "crisis_type": crisis_type,
        "severity": severity,
        "location_name": location,
        "gemini_analysis": analysis,
        "chain_of_thought": chain_of_thought,
        "agent_log": state.get("agent_log", []) + [log],
    }
