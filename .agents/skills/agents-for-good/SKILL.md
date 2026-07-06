---
name: agents-for-good
description: Guidance and protocols for developing safety-critical, humanitarian, crisis-response, accessibility-focused, and ethical agentic AI systems, specifically tailored for RAKSHAK AI.
---
# Agents for Good

This skill provides standard operating procedures, architectural guidelines, and UI/UX design constraints for developing AI systems meant for humanitarian and crisis coordination. 

## Safety-Critical Operations & Fallback Protocols

When developing agent actions for emergency situations, reliability and predictability are paramount.

1. **Dual-Path Redundancy:**
   - Always implement secondary notification pathways (e.g., if a Twilio SMS dispatch fails, fallback to email notifications or webhook alerts to an emergency response center).
   - Provide visual indicators to the user about dispatch status (Pending, Success, Failed, Retrying).

2. **Validation and Sanitization:**
   - Strictly validate all geospatial data (latitudes/longitudes, address strings) and contact numbers before invoking API endpoints.
   - Use the `scripts/validate_safety_config.py` script to verify environmental dependencies prior to deploying or running the agent.

3. **Rate Limiting & Abuse Prevention:**
   - Prevent alert spamming. Implement cooldown tokens or exponential backoffs to avoid overloading emergency dispatch services.

## Accessibility and UI Design

Crisis command centers are high-stress environments. UIs must be clean, highly contrastive, and easy to read.

1. **Visual Contrast:**
   - Adhere to Web Content Accessibility Guidelines (WCAG) 2.1 AAA standards.
   - Use color palette structures with clear semantic meanings:
     - `Danger / Alert`: High-contrast Red (`#EF4444` / HSL `0, 84%, 60%`)
     - `Safe / Normal`: Cyan (`#06B6D4` / HSL `188, 86%, 53%`) or Green (`#10B981`)
     - `Inactive / Neutral`: Sleek Slate Gray (`#64748B` / HSL `215, 16%, 47%`)

2. **Micro-Animations and Real-time Feedback:**
   - Use smooth transitions (e.g., Framer Motion) for status shifts.
   - Visual indicators (like the neural core pulsing orb) should reflect system load and threat level dynamically.

## Ethical Data Handling & Privacy

1. **Data Minimization:**
   - Do not log Personally Identifiable Information (PII) such as phone numbers, precise home addresses, or name fields in plaintext logs.
   - Use hashing or masking for identifiers where possible.

2. **Audit Trails:**
   - Every autonomous action (e.g., dispatching an SMS, changing facility status) must be logged with a timestamp and the reasoning chain for retrospective human audits.

## Executing the Safety Validation Script

To verify that the project configuration is safe and all APIs are active, run:
```bash
python .agents/skills/agents-for-good/scripts/validate_safety_config.py
```
