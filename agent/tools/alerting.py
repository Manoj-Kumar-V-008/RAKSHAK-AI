"""
Twilio SMS & Voice Call alerting tool for Rakshak AI.
Sends real alerts when Twilio credentials are configured,
falls back to structured logging in mock mode.
"""
import os
import logging

logger = logging.getLogger("rakshak.alerting")

TWILIO_SID   = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM  = os.getenv("TWILIO_PHONE_NUMBER", "")

_client = None

def _get_client():
    global _client
    if _client is not None:
        return _client
    if TWILIO_SID and TWILIO_TOKEN:
        try:
            from twilio.rest import Client
            _client = Client(TWILIO_SID, TWILIO_TOKEN)
            logger.info("Twilio client initialized — real SMS enabled.")
            return _client
        except ImportError:
            logger.warning("twilio package not installed. Run: pip install twilio")
    return None


async def send_sms(to: str, message: str, contact_name: str = "Emergency Contact") -> dict:
    """Send SMS via Twilio or log in mock mode."""
    client = _get_client()

    if client and TWILIO_FROM:
        try:
            result = client.messages.create(
                body=message[:1600],
                from_=TWILIO_FROM,
                to=to,
            )
            logger.info(f"SMS sent to {contact_name} ({to}) — SID: {result.sid}")
            return {"status": "sent", "sid": result.sid, "phone": to}
        except Exception as e:
            logger.error(f"SMS to {to} failed: {e}")
            return {"status": "failed", "error": str(e), "phone": to}
    else:
        logger.info(f"[MOCK] SMS to {contact_name} ({to}): {message[:80]}...")
        return {"status": "mock_sent", "phone": to}


async def make_voice_call(to: str, tts_message: str) -> dict:
    """Make a voice call via Twilio or log in mock mode."""
    client = _get_client()

    if client and TWILIO_FROM:
        try:
            twiml = f'<Response><Say voice="alice" language="en-IN">{tts_message}</Say></Response>'
            result = client.calls.create(
                twiml=twiml,
                from_=TWILIO_FROM,
                to=to,
            )
            logger.info(f"Voice call to {to} — SID: {result.sid}")
            return {"status": "called", "sid": result.sid, "phone": to}
        except Exception as e:
            logger.error(f"Voice call to {to} failed: {e}")
            return {"status": "failed", "error": str(e), "phone": to}
    else:
        logger.info(f"[MOCK] Voice call to {to}: {tts_message[:60]}...")
        return {"status": "mock_called", "phone": to}


def build_crisis_sms(crisis_type: str, location: str, severity: int, services: list) -> str:
    """Build a formatted SMS message for crisis alerts."""
    service_names = ", ".join(s.get("name", "Unit") for s in services[:3]) if services else "Emergency services"
    return (
        f"🚨 RAKSHAK AI EMERGENCY ALERT\n\n"
        f"Crisis: {crisis_type.upper()}\n"
        f"Location: {location}\n"
        f"Severity: {severity}/10\n"
        f"Dispatched: {service_names}\n"
        f"Time: {__import__('datetime').datetime.now().strftime('%H:%M:%S')}\n\n"
        f"Emergency services are en route. Follow evacuation protocols.\n\n"
        f"— Rakshak AI Autonomous Crisis Command"
    )
