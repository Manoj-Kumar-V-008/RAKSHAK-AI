<div align="center">
  
# 🛡️ Rakshak AI

**Zero-Touch, AI-Driven Autonomous Crisis Command Platform**

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)

<br/>

### 🔴 [Live Working Prototype](https://rakshak-ai-front-end-008.web.app/)
*(Click to view the deployed application)*

> **⚠️ Note (Free Tier Hosting):** 
> Because this prototype is hosted on free-tier services, the backend servers may "spin down" after a period of inactivity. If the dashboard or AI seems unresponsive or fails on the very first try, **please wait and refresh the page**. It just takes a moment for the AI microservices to wake up!

</div>

---

> **The Problem:** Hospitality venues face unpredictable, high-stakes emergencies that demand instantaneous reactions. Critical information is often siloed, fracturing communication between distressed guests, staff, and first responders resulting in fatal delays.
>
> **The Solution:** **Rakshak AI** acts as an autonomous digital dispatcher and crisis response platform. Built around **Spec-Driven Development** (defined in [agents.md](agents.md)), it replaces manual emergency calls and fragmented chatter with an AI pipeline that automatically analyzes threats, dynamically maps nearest emergency stations, and executes verified dispatches under strict human oversight.

---

## ✨ Core Features & Concepts

- **🧠 LangGraph Agent Pipeline:** A Python-powered LangGraph agent that ingests incident data and autonomously evaluates threat severity without human bottleneck.
- **👁️ Trajectory Observability Dashboard:** A dedicated UI panel provides full execution trace and reasoning visibility. This operator observability allows commanders to monitor real-time decision steps, debug agent behavior, and avoid fragile success traps.
- **🛡️ Human-in-the-Loop (HITL) Checkpoint:** Critical real-world actions (such as emergency SMS dispatches) require explicit operator confirmation during an approval checkpoint window, establishing **Effective Trust** before execution.
- **🗺️ Hyper-Local Dynamic Mapping & MCP-Inspired Tooling:** Integrates with the Overpass API to scan the venue's geographical radius for nearest Police, Fire, or Medical units following Model Context Protocol (MCP) design philosophy.
- **💬 Standardized SMS Dispatch:** Automatically formats and blasts SOS SMS alerts to designated emergency responders via Twilio.
- **🏢 Digital Twin & Spatial Awareness:** Includes a 3D Facility Twin to give on-site security spatial layout awareness of the threat location within the building.
- **❤️ Rakshak Neural Core:** A central visual indicator tracking system status and threat levels in real time.
- **🎮 Built-In Crisis Simulator:** Allows stakeholders to inject simulated emergency scenarios into the system to test AI response latency safely.
- **📦 Agent Skills & Progressive Disclosure:** Modular skills organized inside `.agents/skills/` (such as `agents-for-good`) load metadata on demand to reduce context rot and maintain high agent efficiency.

---

## 🛠️ Tech Stack & Design Philosophy

- **AI & Logic Engine:** Google Gemini LLM, LangChain, LangGraph, Python 3, FastAPI, Uvicorn.
- **Frontend Command Center:** React.js (Vite), Framer Motion, React Flow (`@xyflow/react`), Modern CSS.
- **API Gateway & Orchestration:** Node.js, Express.js.
- **MCP-Inspired Tool Integrations:** Twilio SMS API, Overpass API (OpenStreetMap), TomTom Traffic API.
- **Spec-Driven Development:** Global durable specification maintained in [agents.md](agents.md).

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    classDef frontend fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff,rx:5px,ry:5px;
    classDef nodejs fill:#1e293b,stroke:#10b981,stroke-width:2px,color:#fff,rx:5px,ry:5px;
    classDef python fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#fff,rx:5px,ry:5px;
    classDef external fill:#1e293b,stroke:#ef4444,stroke-width:2px,color:#fff,rx:5px,ry:5px;
    classDef skills fill:#1e293b,stroke:#8b5cf6,stroke-width:2px,color:#fff,rx:5px,ry:5px;

    subgraph Client ["🖥️ Client Tier (Frontend & Observability)"]
        UI[React.js Command Dashboard]:::frontend
        Twin[Facility Digital Twin]:::frontend
        Obs[Trajectory Observability Dashboard]:::frontend
        HITL[Human-in-the-Loop Checkpoint]:::frontend
    end

    subgraph Gateway ["⚙️ Orchestration Tier (Node.js)"]
        Node[Express.js API Gateway]:::nodejs
    end

    subgraph AI ["🧠 AI Processing Tier (Python Microservice)"]
        Fast[FastAPI & Uvicorn]:::python
        Lang[LangGraph Orchestration]:::python
        LLM[Google Gemini Core LLM]:::python
        Skills[Agent Skills Directory - Progressive Disclosure]:::skills
        
        Fast <--> Lang
        Lang <--> LLM
        Lang <--> Skills
    end

    subgraph External ["🌍 MCP-Inspired External Integrations"]
        Twilio[Twilio SMS API]:::external
        Maps[Overpass OSM API & Traffic]:::external
    end

    %% Connections
    UI <-->|HTTP/WS| Node
    Twin -.-> UI
    Obs -.-> UI
    HITL -.-> UI
    
    Node <-->|REST Relay| Fast
    Lang -->|Radius Search| Maps
    HITL -->|Operator Approval| Node
    Node -->|Validated Dispatch| Twilio
```

### Architectural Highlights:
- **Progressive Disclosure via Agent Skills:** Skills in `.agents/skills/` load full guidance only when relevant triggers occur, avoiding context bloat.
- **MCP-Inspired Extensibility:** External integrations follow the Model Context Protocol design philosophy, standardizing tool-agent communication.
- **Human-in-the-Loop Safeguards:** External dispatches pause at an explicit approval checkpoint for operator confirmation.
- **Trajectory Observability:** Observable execution traces surface every step from detection to tool selection without revealing internal hidden model states.

---

## 📂 Repository Structure

```
RAKSHAK-AI/
├── agents.md                            # Durable Project Specification (Spec-Driven Development)
├── README.md                            # Project Overview & Documentation
├── render.yaml                          # Cloud Service Deployment Specification
├── rakshak.bat                          # Command Launcher Script
├── server.js                            # Root Bootstrap Entrypoint
├── .agents/                             # Agent Skills Directory (Progressive Disclosure)
│   └── skills/
│       └── agents-for-good/             # Safety, Accessibility & Ethics Skill
│           ├── SKILL.md                 # Metadata & SOP Instructions
│           ├── references/
│           │   └── safety_guidelines.md # Emergency System Safety Standards
│           └── scripts/
│               └── validate_safety_config.py # Deterministic Safety Validator
├── backend/
│   ├── backend-node/                    # Node.js API Gateway & Twilio Relay
│   └── backend-python/                  # LangGraph AI Agent & FastAPI Service
├── frontend/                            # React.js Command Center Dashboard
├── Project_Images/                      # Screenshots & Visual Documentation
└── Report                               # Technical Capabilities Document
```

---

## 🛡️ Safety Validation & Guardrails

To enforce deterministic validation before deployment, Rakshak AI includes an automated safety configuration validator:

```bash
python .agents/skills/agents-for-good/scripts/validate_safety_config.py
```
*(or via npm)*:
```bash
npm run validate:safety
```

### Deterministic Guardrails:
- **Pre-Flight Configuration Audit:** Verifies that API credentials (Gemini, Twilio) are properly configured and not set to placeholder strings before starting microservices.
- **Input & Tool Call Validation:** Geolocation coordinates, phone numbers, and threat levels are sanitized prior to invoking external tools.
- **Fail-Safe Degradation:** If live APIs encounter outages, the system degrades safely to pre-cached local emergency station databases.

---

## 🎓 Alignment with Google Agents for Good Course

This repository demonstrates key concepts taught in Google's **Agents for Good** course:

- **✓ Agent Skills:** Modular capability packages housed under `.agents/skills/` providing specialized instructions and SOPs.
- **✓ Progressive Disclosure:** Small metadata footprints in active memory trigger skill loading only when required, preventing context rot.
- **✓ Model Context Protocol (MCP) Design Philosophy:** External integrations (Twilio, Overpass, Maps) are architected following MCP design patterns for extensible agent-tool communication.
- **✓ Human-in-the-Loop (HITL):** High-stakes dispatches require explicit human confirmation during an approval checkpoint, fostering Effective Trust.
- **✓ Trajectory Observability:** Observable execution steps are visualized live on the dashboard, giving operators clear insight into agent progression while avoiding fragile success traps.
- **✓ Safety Guardrails:** Deterministic validation, rate limiting, and safe fallback mechanisms ensure reliability in crisis scenarios.
- **✓ Spec-Driven Development:** The durable global specification in [agents.md](agents.md) guides evolving implementations.
- **✓ Deterministic Validation:** Automated validation scripts (`validate_safety_config.py`) verify safety parameters before deployment.

---

## 🚀 Local Development

Install dependencies for all workspaces:

```bash
npm run setup
```

Run pre-flight safety validation:

```bash
npm run validate:safety
```

Run all services concurrently:

```bash
npm run dev
```

**Default local ports:**
- Frontend: `http://localhost:5173`
- Node relay: `http://localhost:3000`
- Python agent: `http://localhost:8000`

---

## ☁️ Deployment

The included `render.yaml` handles deploying the microservices:

1. `rakshak-backend` as the public web app and Node relay
2. `rakshak-agent` as the Python LangGraph agent

**Deployment details:**
- Node service builds the frontend and serves `frontend/dist` directly.
- Node service communicates with Python agent via `PYTHON_AGENT_URL`.

---

## 🔐 Environment Variables

**Python Agent (`backend/backend-python/.env`):**
- `GEMINI_API_KEY`
- `TOMTOM_API_KEY` *(Optional fallback)*

**Node Relay (`backend/backend-node/.env`):**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

**Frontend (`frontend/.env` - Optional):**
- `VITE_BACKEND_URL`
