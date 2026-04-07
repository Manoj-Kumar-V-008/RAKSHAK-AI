import os
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
_model = genai.GenerativeModel("gemini-2.0-flash")

from ..state import CrisisState


def detect_crisis(state: CrisisState) -> dict:
    """
    Node 1 — DETECT: Classifies the sensor anomaly, assigns severity,
    and builds a chain-of-thought reasoning trace.
    """
    sensor = state.get("sensor_data", {})
    s_type  = sensor.get("type", "unknown")
    s_value = sensor.get("value", 0)
    s_loc   = sensor.get("location", "Unknown")

    prompt = f"""You are RAKSHAK AI, a crisis-detection engine.

Sensor telemetry received:
  Type:     {s_type}
  Value:    {s_value}
  Location: {s_loc}
  Extra:    {sensor}

TASK: Classify this event and determine severity.

FORMAT YOUR RESPONSE EXACTLY like this (use the exact labels):
CRISIS_TYPE: <one of: smoke, fire, health, cardiac, security, breach, power, water>
SEVERITY: <integer 1-10>
ANALYSIS: <2-3 sentence explanation>
REASONING_STEPS:
1. <first reasoning step>
2. <second reasoning step>
3. <third reasoning step>

Be analytical and reference specific sensor values and thresholds.
"""

    try:
        resp = _model.generate_content(prompt)
        text = resp.text.strip()
    except Exception as e:
        text = f"CRISIS_TYPE: {s_type}\nSEVERITY: 6\nANALYSIS: Classification fallback — Gemini unreachable ({e})."

    # Parse structured fields
    crisis_type = s_type
    severity = 6
    analysis = text
    cot_steps = []

    for line in text.split("\n"):
        line_s = line.strip()
        if line_s.startswith("CRISIS_TYPE:"):
            crisis_type = line_s.split(":", 1)[1].strip().lower()
        elif line_s.startswith("SEVERITY:"):
            try:
                severity = int(line_s.split(":", 1)[1].strip())
            except ValueError:
                pass
        elif line_s.startswith("ANALYSIS:"):
            analysis = line_s.split(":", 1)[1].strip()
        elif line_s and line_s[0].isdigit() and "." in line_s[:3]:
            step_text = line_s.split(".", 1)[1].strip() if "." in line_s else line_s
            cot_steps.append(step_text)

    # Build chain-of-thought from parsed + generated steps
    chain_of_thought = state.get("chain_of_thought", [])
    chain_of_thought.append({
        "node": "detect_crisis",
        "text": f"Sensor {sensor.get('sensor_id', 'UNKNOWN')} anomaly detected. Type: {crisis_type.upper()}, Value: {s_value}, Location: {s_loc}.",
        "factors": [f"Sensor value: {s_value}", f"Crisis type: {crisis_type}", f"Location: {s_loc}"],
    })
    for step in cot_steps:
        chain_of_thought.append({
            "node": "detect_crisis",
            "text": step,
        })
    chain_of_thought.append({
        "node": "detect_crisis",
        "text": f"Classification complete: {crisis_type.upper()}, Severity: {severity}/10. {analysis}",
        "factors": [f"Severity: {severity}/10", f"Analysis: {analysis[:80]}"],
    })

    return {
        "crisis_type": crisis_type,
        "severity": severity,
        "gemini_analysis": analysis,
        "chain_of_thought": chain_of_thought,
    }
