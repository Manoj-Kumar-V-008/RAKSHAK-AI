# Rakshak AI Agent Specification

## Project Overview
Rakshak AI is a privacy-first AI assistant designed to protect citizens, venue guests, and facilities from scams, cybercrime, and physical emergencies using intelligent AI assistance combined with strict human oversight.

## Mission
- **Detect Threats:** Continuously monitor sensor mesh telemetry, user reports, and crisis signals in real time.
- **Analyze Situations:** Dynamically evaluate threat severity, geographical radius, and mitigation requirements.
- **Recommend Safe Actions:** Formulate structured emergency response plans and responder routing strategies.
- **Assist Emergency Response:** Provide precise geospatial mapping, 3D facility layout context, and emergency contact dispatching.
- **Always Keep Humans in Control:** Ensure human operators maintain absolute authority over high-stakes dispatches and real-world actions.

## System Architecture

```
React Frontend
      ↓
Node.js Backend
      ↓
Python AI Agent (LangGraph)
      ↓
Google Gemini
      ↓
External Tools
```

### Integrated Tools & Services
- **Twilio SMS:** Automated dispatch of structured crisis SMS alerts to first responders and emergency contacts.
- **Overpass API:** Dynamic geographical radius scanning for nearby police, fire, and medical stations via OpenStreetMap.
- **Maps & Geolocation:** Routing, distance/ETA calculations (OSRM), and live traffic flow visualization (TomTom).
- **Emergency Contacts:** Verified directory of venue security, first responders, and emergency contacts.

## Agent Responsibilities
- **Understand User Reports:** Parse incident reports, sensor data, and crisis telemetry accurately.
- **Reason About Threats:** Formulate multi-step cognitive plans and determine severity levels using LangGraph workflow nodes.
- **Choose Appropriate Tools:** Select external APIs dynamically (e.g., station radius search, location lookup, SMS formatting).
- **Ask for Human Approval:** Pause execution at a designated checkpoint before initiating any high-risk external actions.
- **Log Decisions Safely:** Construct timestamped, auditable execution traces for post-incident review and legal compliance.

## Guardrails
- **Never perform emergency dispatch automatically:** High-stakes external actions are strictly gated by human authorization.
- **Require explicit human approval:** Present execution plans to operators via a Human-in-the-Loop checkpoint window before dispatching alerts.
- **Validate all tool inputs:** Geolocation coordinates, phone numbers, threat levels, and API parameters are strictly sanitized before execution.
- **Fail safely:** If external integrations (e.g., Overpass API or Twilio) fail or time out, the system degrades gracefully to pre-cached static emergency databases.
- **Prioritize user privacy:** Minimize Personally Identifiable Information (PII) collection and mask sensitive guest/victim details in logs.
- **Keep reasoning observable:** Maintain visible, auditable execution traces without exposing internal hidden model states.

## Success Principles
- **Transparency:** Full operator visibility into every decision step and tool execution path.
- **Human Safety:** Prioritizing human life and physical security above automated operations.
- **Explainability:** Clear, human-understandable reasoning trajectories accessible to dispatchers.
- **Reliability:** Deterministic fallback mechanisms guaranteeing operational continuity during API disruptions.
- **Privacy-First Design:** Strict minimization of PII and secure data handling standards.

---

> *Note: This document serves as the canonical, durable project specification for Rakshak AI (Spec-Driven Development). While implementation details, microservices, and UI frameworks may evolve over time, system behavior must always align with the specification defined in this file.*
