import os
import json
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
_model = genai.GenerativeModel("gemini-2.0-flash")

from ..state import CrisisState


def decide_dispatch(state: CrisisState) -> dict:
    """
    Node 4 — DECIDE: Uses Gemini to select optimal units and provides
    rejection reasoning for non-selected alternatives.
    """
    scored = state.get("scored_services", [])
    crisis_type = state.get("crisis_type", "unknown")
    severity = state.get("severity", 5)
    threat_score = state.get("refined_threat_score", state.get("threat_score", 50))
    cascade_risk = state.get("cascade_risk", 0)

    if not scored:
        return {
            "dispatched_services": [],
            "dispatch_reasoning": "No scored services to evaluate.",
            "rejected_services": [],
        }

    # Top candidates per type
    top_by_type = {}
    for s in scored:
        t = s.get("service_type", "unknown")
        if t not in top_by_type:
            top_by_type[t] = []
        top_by_type[t].append(s)

    # Flatten top-3 per type
    candidates = []
    for t, svcs in top_by_type.items():
        candidates.extend(svcs[:3])

    summary_lines = []
    for s in candidates:
        sc = s.get("scores", {})
        summary_lines.append(
            f"  - {s.get('name', '?')} ({s.get('service_type', '?')}) | "
            f"Dist: {s.get('distance_km', '?')}km | Score: {sc.get('total', '?')} | "
            f"Phone: {s.get('phone', 'N/A')}"
        )

    prompt = f"""You are RAKSHAK AI dispatch commander.

CRISIS: {crisis_type.upper()} | Severity: {severity}/10 | ThreatScore: {threat_score}/100 | CascadeRisk: {(cascade_risk*100):.0f}%

AVAILABLE SERVICES (scored):
{chr(10).join(summary_lines)}

RULES:
- For severity >= 7: MUST dispatch all 3 service types (fire, hospital, police)
- For severity 4-6: dispatch at least 2 relevant types
- For severity <= 3: dispatch 1 primary type
- Select the highest-scored service of each required type

RESPOND IN THIS EXACT FORMAT:
SELECTED: <comma-separated names of selected services>
REASONING_STEPS:
1. <step 1: analyze the crisis needs>
2. <step 2: evaluate the top candidates>
3. <step 3: finalize the decision>
REJECTED: <for each non-selected service, one line: name | reason for rejection>
"""

    try:
        resp = _model.generate_content(prompt)
        text = resp.text.strip()
    except Exception as e:
        text = f"SELECTED: {candidates[0].get('name', 'Unknown') if candidates else 'None'}\nREASONING_STEPS:\n1. Fallback selection due to Gemini error ({e})\nREJECTED:"

    # Parse response
    selected_names = set()
    cot_steps = []
    rejected_list = []

    for line in text.split("\n"):
        line_s = line.strip()
        if line_s.startswith("SELECTED:"):
            names = line_s.split(":", 1)[1].strip()
            selected_names = {n.strip().lower() for n in names.split(",")}
        elif line_s and line_s[0].isdigit() and "." in line_s[:3]:
            step_text = line_s.split(".", 1)[1].strip() if "." in line_s else line_s
            cot_steps.append(step_text)
        elif "|" in line_s and not line_s.startswith("SELECTED") and not line_s.startswith("REASONING"):
            parts = line_s.split("|", 1)
            rejected_list.append({
                "name": parts[0].strip().lstrip("- "),
                "reason": parts[1].strip() if len(parts) > 1 else "Not selected",
            })

    # Match selected names to actual service objects
    dispatched = []
    seen_types = set()

    # First: exact matches
    for s in candidates:
        if s.get("name", "").lower() in selected_names and s.get("service_type") not in seen_types:
            dispatched.append(s)
            seen_types.add(s.get("service_type"))

    # Fallback: ensure at least one per required type for high severity
    if severity >= 7:
        for needed_type in ["fire_station", "hospital", "police"]:
            if needed_type not in seen_types:
                for s in scored:
                    if s.get("service_type") == needed_type:
                        dispatched.append(s)
                        seen_types.add(needed_type)
                        break

    # If still empty, take top candidate
    if not dispatched and candidates:
        dispatched = [candidates[0]]

    # Build chain-of-thought
    chain_of_thought = state.get("chain_of_thought", [])
    for step in cot_steps:
        chain_of_thought.append({
            "node": "decide_dispatch",
            "text": step
        })
    
    chain_of_thought.append({
        "node": "decide_dispatch",
        "text": f"FINAL DECISION MADE: Dispatch instructions locked.",
        "factors": [f"Selected: {', '.join(s.get('name', '?') for s in dispatched)}"],
    })
    if rejected_list:
        chain_of_thought.append({
            "node": "decide_dispatch",
            "text": f"Rejected {len(rejected_list)} alternatives: " + "; ".join(f"{r['name']} ({r['reason']})" for r in rejected_list[:3]),
            "factors": [f"{r['name']}: {r['reason']}" for r in rejected_list[:5]],
        })

    # Determine if confirmation is required (high severity = always)
    confirmation_required = severity >= 6

    return {
        "dispatched_services": dispatched,
        "dispatch_reasoning": " ".join(cot_steps),
        "rejected_services": rejected_list,
        "chain_of_thought": chain_of_thought,
        "confirmation_required": confirmation_required,
        "confirmation_status": "pending" if confirmation_required else "auto_approved",
    }
