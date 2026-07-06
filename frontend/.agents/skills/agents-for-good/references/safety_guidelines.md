# Humanitarian & Crisis Response AI Safety Guidelines

When building AI systems to coordinate disaster recovery, emergency dispatch, or crisis command (like RAKSHAK AI), the team must adhere to the following principles:

## 1. Zero-Failure Dispatching (Fail-Safe Architecture)
- **Primary vs. Backup Systems:** If the primary integration (e.g., Twilio SMS API) returns any non-2xx status, log the failure in detail immediately and switch to the backup (e.g., automated email or SMS via alternate carrier).
- **Human-in-the-loop (HITL):** Always provide a manual fallback mechanism. If the automated dispatch pipeline hangs or times out, present clear buttons in the dashboard for dispatchers to override/trigger manually.

## 2. Inclusive and Accessible UI/UX Design
Crisis dispatchers are often under extreme stress and working in low-light/high-pressure situations.
- **Visual Clarity:**
  - Standard state colors:
    - **Normal/Stable:** `#06B6D4` (Cyan) - represents steady heartbeat, listening/ready state.
    - **Warning/Escalation:** `#F59E0B` (Amber) - indicates active evaluation or threat detected.
    - **Crisis/Active Danger:** `#EF4444` (Red) - indicates confirmed high-threat active danger, SMS dispatches initiated.
- **Font & Hierarchy:** Use Sans-Serif fonts with high contrast (e.g., contrast ratio > 7:1 against dark backgrounds for small text, > 4.5:1 for headers).
- **Audio Cues:** Add subtle, non-intrusive sound alerts to draw attention to high-threat warnings without causing panic.

## 3. Privacy, Data Protection, and Compliance
- **Masking Sensitive Data:** Always mask the last 4 digits of phone numbers in logging interfaces. Do not print plain-text user/guest names to standard output console logs.
- **Audit Logging:** Record the following for post-incident review:
  - System threat assessment scores and LLM "Chain of Thought" reasoning.
  - Latency times from incident ingestion to SMS dispatch confirmation.
  - Click-through and acknowledgment times by human supervisors.
