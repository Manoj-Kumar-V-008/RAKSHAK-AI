import re

from ..llm import AgentLLMError, generate_text
from ..state import CrisisState
from ..tools.scoring import TYPE_WEIGHTS


def _required_types(crisis_type: str, severity: int) -> list[str]:
    """
    Determine which responder types are needed based on crisis type AND severity.
    Unlike the old logic, we don't blindly dispatch all 3 types for high severity.
    """
    # Crisis-specific primary and secondary responders
    CRISIS_DISPATCH_MAP = {
        "smoke":    {"primary": ["fire_station"], "secondary": ["hospital"], "tertiary": ["police"]},
        "fire":     {"primary": ["fire_station"], "secondary": ["hospital"], "tertiary": ["police"]},
        "health":   {"primary": ["hospital"], "secondary": ["police"], "tertiary": []},
        "cardiac":  {"primary": ["hospital"], "secondary": ["police"], "tertiary": []},
        "security": {"primary": ["police"], "secondary": ["hospital"], "tertiary": []},
        "breach":   {"primary": ["police"], "secondary": ["hospital"], "tertiary": []},
        "power":    {"primary": ["fire_station"], "secondary": ["police"], "tertiary": ["hospital"]},
        "water":    {"primary": ["fire_station"], "secondary": ["hospital"], "tertiary": ["police"]},
    }

    dispatch = CRISIS_DISPATCH_MAP.get(crisis_type, {"primary": ["hospital"], "secondary": ["police"], "tertiary": ["fire_station"]})

    if severity >= 8:
        # Critical: dispatch primary + secondary + tertiary (if exists)
        return dispatch["primary"] + dispatch["secondary"] + dispatch.get("tertiary", [])
    elif severity >= 5:
        # Elevated: dispatch primary + secondary
        return dispatch["primary"] + dispatch["secondary"]
    else:
        # Low: dispatch primary only
        return dispatch["primary"]


def _fallback_decision(
    scored: list[dict],
    candidates: list[dict],
    crisis_type: str,
    severity: int,
) -> dict:
    required_types = _required_types(crisis_type, severity)
    dispatched: list[dict] = []
    selected_ids: set[str] = set()

    for service_type in required_types:
        choice = next((svc for svc in scored if svc.get("service_type") == service_type), None)
        if choice and str(choice.get("id")) not in selected_ids:
            dispatched.append(choice)
            selected_ids.add(str(choice.get("id")))

    if not dispatched and scored:
        dispatched = [scored[0]]
        selected_ids.add(str(scored[0].get("id")))

    reasoning_steps = [
        f"Mapped {crisis_type} severity {severity}/10 to required responder types: {', '.join(required_types)}.",
        "Ranked candidates by composite service score and preferred the top unit for each required type.",
        "Selected the closest high-scoring responders that satisfy the dispatch rule for this severity band.",
    ]

    selected_by_type = {svc.get("service_type"): svc for svc in dispatched}
    rejected = []
    for svc in candidates:
        svc_id = str(svc.get("id"))
        if svc_id in selected_ids:
            continue

        chosen = selected_by_type.get(svc.get("service_type"))
        if svc.get("service_type") not in required_types:
            reason = "Service type not required for the current severity band"
        elif chosen:
            reason = (
                f"Lower score than selected {svc.get('service_type')} unit "
                f"({chosen.get('name', 'selected unit')})"
            )
        else:
            reason = "Higher-priority responders were selected first"

        rejected.append({
            "name": svc.get("name", "Unknown"),
            "id": svc_id,
            "reason": reason,
        })

    return {
        "selected_tokens": selected_ids,
        "steps": reasoning_steps,
        "rejected": rejected,
    }


def _parse_decision_response(text: str, fallback: dict) -> dict:
    selected_tokens = set(fallback["selected_tokens"])
    steps: list[str] = []
    rejected = list(fallback["rejected"])

    parsed_rejected: list[dict] = []
    for line in text.splitlines():
        line_s = line.strip()
        if not line_s:
            continue

        if line_s.startswith("SELECTED_IDS:"):
            tokens = [
                token.strip().lower()
                for token in line_s.split(":", 1)[1].split(",")
                if token.strip()
            ]
            if tokens:
                selected_tokens = set(tokens)
        elif re.match(r"^\d+\.\s+", line_s):
            steps.append(line_s.split(".", 1)[1].strip())
        elif "|" in line_s and not line_s.startswith("REJECTED"):
            left, right = line_s.split("|", 1)
            parsed_rejected.append({
                "id": left.strip().lstrip("- ").lower(),
                "reason": right.strip(),
            })

    if parsed_rejected:
        rejected = parsed_rejected

    return {
        "selected_tokens": selected_tokens,
        "steps": steps or fallback["steps"],
        "rejected": rejected,
    }


def decide_dispatch(state: CrisisState) -> dict:
    """
    Node 4 - DECIDE: select the best responders and explain why alternatives
    were rejected.
    """
    scored = state.get("scored_services", [])
    crisis_type = state.get("crisis_type", "unknown")
    severity = state.get("severity", 5)
    threat_score = state.get("refined_threat_score", state.get("threat_score", 50))
    cascade_risk = state.get("cascade_risk", 0)

    if not scored:
        log = {
            "node": "decide_dispatch",
            "summary": "No scored services were available for dispatch.",
            "data": {"selected": [], "rejected": []},
        }
        return {
            "best_service": None,
            "dispatched_services": [],
            "dispatch_reasoning": "No scored services to evaluate.",
            "dispatch_status": "blocked",
            "rejected_services": [],
            "agent_log": state.get("agent_log", []) + [log],
        }

    top_by_type: dict[str, list[dict]] = {}
    for service in scored:
        service_type = service.get("service_type", "unknown")
        top_by_type.setdefault(service_type, []).append(service)

    candidates: list[dict] = []
    for services in top_by_type.values():
        candidates.extend(services[:3])

    summary_lines = []
    for service in candidates:
        scores = service.get("scores", {})
        summary_lines.append(
            f"- ID: {service.get('id')} | Name: {service.get('name', '?')} | "
            f"Type: {service.get('service_type', '?')} | Dist: {service.get('distance_km', '?')}km | "
            f"Score: {scores.get('total', '?')} | Phone: {service.get('phone', 'N/A')}"
        )

    fallback = _fallback_decision(scored, candidates, crisis_type, severity)
    prompt = f"""You are RAKSHAK AI dispatch commander.

CRISIS: {crisis_type.upper()} | Severity: {severity}/10 | ThreatScore: {threat_score}/100 | CascadeRisk: {(cascade_risk * 100):.0f}%

AVAILABLE SERVICES:
{chr(10).join(summary_lines)}

RULES:
- Match responder types to crisis type: fire/smoke→fire_station primary, health/cardiac→hospital primary, breach/security→police primary
- For severity >= 8: dispatch primary + secondary + tertiary responders (if applicable)
- For severity 5-7: dispatch primary + secondary responders
- For severity <= 4: dispatch primary responder only
- NEVER dispatch fire_station for security/breach crises. NEVER dispatch fire_station for health/cardiac crises.
- Prefer the highest-scoring unit of each required type

RESPOND IN THIS EXACT FORMAT:
SELECTED_IDS: <comma-separated service ids>
REASONING_STEPS:
1. <step 1: analyze the crisis needs>
2. <step 2: evaluate the top candidates>
3. <step 3: finalize the decision>
REJECTED:
<service id> | <reason>
"""

    try:
        parsed = _parse_decision_response(
            generate_text(prompt, task_name="decide_dispatch"),
            fallback,
        )
    except AgentLLMError as exc:
        parsed = {
            **fallback,
            "steps": fallback["steps"] + [f"AI model fallback engaged because: {exc}"],
        }

    selected_tokens = {token.lower() for token in parsed["selected_tokens"]}
    dispatched: list[dict] = []
    seen_types: set[str] = set()

    for service in candidates:
        service_id = str(service.get("id", "")).lower()
        service_name = str(service.get("name", "")).lower()
        service_type = service.get("service_type")
        if (
            (service_id in selected_tokens or service_name in selected_tokens)
            and service_type not in seen_types
        ):
            dispatched.append(service)
            seen_types.add(service_type)

    # Fill in any missing required types using _required_types (crisis-aware)
    required = _required_types(crisis_type, severity)
    for required_type in required:
        if required_type in seen_types:
            continue
        fallback_choice = next(
            (service for service in scored if service.get("service_type") == required_type),
            None,
        )
        if fallback_choice:
            dispatched.append(fallback_choice)
            seen_types.add(required_type)

    if not dispatched:
        for service in scored:
            service_id = str(service.get("id", "")).lower()
            if service_id in selected_tokens:
                dispatched.append(service)
                break

    if not dispatched:
        dispatched = [scored[0]]

    best_service = dispatched[0] if dispatched else None
    rejected_list = parsed["rejected"]
    confirmation_required = severity >= 6
    status = "pending_confirmation" if confirmation_required else "auto_approved"

    chain_of_thought = state.get("chain_of_thought", [])
    for step in parsed["steps"]:
        chain_of_thought.append({
            "node": "decide_dispatch",
            "text": step,
        })

    chain_of_thought.append({
        "node": "decide_dispatch",
        "text": "Final dispatch decision locked.",
        "factors": [
            f"Selected: {', '.join(service.get('name', '?') for service in dispatched)}",
            f"Confirmation required: {confirmation_required}",
        ],
    })

    if rejected_list:
        chain_of_thought.append({
            "node": "decide_dispatch",
            "text": (
                f"Rejected {len(rejected_list)} alternatives: "
                + "; ".join(
                    f"{item.get('name', item.get('id', 'unknown'))} ({item.get('reason', 'Not selected')})"
                    for item in rejected_list[:3]
                )
            ),
            "factors": [
                f"{item.get('name', item.get('id', 'unknown'))}: {item.get('reason', 'Not selected')}"
                for item in rejected_list[:5]
            ],
        })

    log = {
        "node": "decide_dispatch",
        "summary": (
            "Dispatch selected: "
            + ", ".join(service.get("name", "Unknown") for service in dispatched)
        ),
        "data": {
            "selected": [
                {
                    "id": service.get("id"),
                    "name": service.get("name"),
                    "type": service.get("service_type"),
                }
                for service in dispatched
            ],
            "rejected": rejected_list[:10],
        },
    }

    return {
        "best_service": best_service,
        "dispatched_services": dispatched,
        "dispatch_reasoning": " ".join(parsed["steps"]),
        "dispatch_status": status,
        "rejected_services": rejected_list,
        "chain_of_thought": chain_of_thought,
        "confirmation_required": confirmation_required,
        "confirmation_status": "pending" if confirmation_required else "auto_approved",
        "agent_log": state.get("agent_log", []) + [log],
    }
