# Rakshak AI Global Agent Specification

> **Durable Project Specification**
> This document serves as the canonical, durable specification for **Rakshak AI**, defining system intent, agent mission, core principles, architecture, workflow, safety guardrails, and success metrics. Implementation details may evolve, but system behavior must always align with this specification.

---

## Project Vision

**Rakshak AI** is a privacy-first AI agent ecosystem designed to protect citizens and venue guests from scams, cybercrime, and physical emergencies through intelligent assistance, dynamic threat analysis, and robust human oversight.

---

## Agent Mission

The mission of Rakshak AI is to:
1. **Accelerate Crisis Response:** Minimize critical delays during emergency situations by automating geographic analysis, threat evaluation, and responder routing.
2. **Protect Citizens & Venues:** Provide zero-touch threat detection and real-time situational awareness for hospitality venues, corporate facilities, and public spaces.
3. **Ensure Human Control:** Maintain safety-critical human-in-the-loop oversight before executing any high-stakes external actions.

---

## Core Principles

- **Privacy First:** Minimize Personally Identifiable Information (PII) collection and storage. Never broadcast unencrypted guest or victim details.
- **Human Safety:** Prioritize human life and physical safety above all technical or automated operations.
- **Human Approval:** Require explicit Human-in-the-Loop (HITL) authorization for critical, real-world actions (such as SMS dispatches).
- **Transparency:** Provide clear, observable execution traces showing how and why threat assessments were formed.
- **Explainability:** Ensure all AI reasoning steps are auditable and human-understandable.
- **Reliable Decision Making:** Use deterministic fallback mechanisms (e.g., cached geofences, static emergency databases) when external services fail.
- **Secure Tool Usage:** Validate tool inputs, parameters, and rate limits strictly before tool execution.

---

## High-Level Architecture

```
User / Sensor Mesh
       ↓
React Command Dashboard (Frontend)
       ↓
Node.js Express API Gateway (Orchestration Relay)
       ↓
Python AI Agent (LangGraph Workflow Engine)
       ↓
Google Gemini Core LLM
       ↓
External Tools & MCP-Inspired Integrations
(Twilio SMS API | Overpass OSM API | TomTom Maps | Geolocation)
```

### Integrated Systems & External Tools
- **Twilio SMS API:** Automated dispatch of structured crisis SMS alerts to emergency contacts.
- **Overpass API (OpenStreetMap):** Dynamic geographical radius scanning for police, fire, and medical stations.
- **Maps & Geolocation:** Distance, ETA calculations (OSRM), and live traffic flow visualization (TomTom).
- **Emergency Contacts Database:** Verified registry of venue security and first responders.

---

## Agent Workflow

The agent operates in a structured 6-phase lifecycle:

```
[1. Detection] → [2. Reasoning] → [3. Tool Selection] → [4. Human Approval] → [5. Action] → [6. Logging]
```

1. **Detection:** Ingest threat signals, IoT telemetry, or user-injected crisis events.
2. **Reasoning:** Evaluate severity, geographical radius, and mitigation options via LangGraph cognitive nodes.
3. **Tool Selection:** Determine required external integrations (e.g., Overpass API station lookup, Twilio dispatch).
4. **Human Approval:** Present the execution plan to human operators via a dedicated checkpoint modal.
5. **Action:** Execute authorized dispatches and route emergency responder notifications.
6. **Logging:** Record an immutable timestamped event log for post-incident auditing.

---

## Guardrails

- **Human-in-the-Loop Requirement:** High-risk actions (e.g., SMS dispatch to emergency services) must require human operator confirmation during the approval checkpoint window.
- **Tool Call Validation:** Every tool parameter (coordinates, phone numbers, threat levels) must be validated before execution.
- **Fail-Safe Execution:** If external APIs (Overpass API or Twilio) fail or time out, the system must degrade gracefully to local static emergency databases and notify the operator.
- **Rate Limiting & Anti-Spam:** Cooldown timers prevent duplicate or runaway automated dispatches.

---

## Success Metrics

- **False Positives Reduced:** Minimizing erroneous threat escalations through multi-point sensor and reasoning checks.
- **Human Approval Rate:** Tracking operator confirmation rates to refine AI confidence thresholds.
- **Successful Intervention:** Reducing average incident response and dispatch latency.
- **Transparent Reasoning:** Ensuring 100% of autonomous escalations produce auditable execution trajectories.
