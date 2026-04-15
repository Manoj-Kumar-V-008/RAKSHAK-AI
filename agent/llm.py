import os
import time
from functools import lru_cache
from threading import Lock
from typing import Any


class AgentLLMError(RuntimeError):
    """Raised when the configured LLM cannot be used."""


DEFAULT_MODEL_CANDIDATES = (
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
)

_cooldown_lock = Lock()
_cooldown_until = 0.0


def _set_cooldown(seconds: int) -> None:
    global _cooldown_until
    with _cooldown_lock:
        _cooldown_until = max(_cooldown_until, time.time() + max(seconds, 1))


def _cooldown_remaining() -> int:
    with _cooldown_lock:
        remaining = _cooldown_until - time.time()
    return max(0, int(remaining + 0.999))


def _model_candidates() -> list[str]:
    configured = (
        os.getenv("RAKSHAK_GEMINI_MODEL")
        or os.getenv("GEMINI_MODEL")
        or ""
    ).strip()

    if configured:
        return [configured]

    return list(DEFAULT_MODEL_CANDIDATES)


def _normalize_error_message(exc: Exception) -> str:
    raw = str(exc).strip()
    upper = raw.upper()

    if "RESOURCE_EXHAUSTED" in upper or "429" in upper:
        return "Gemini quota exhausted (429). Local autonomous fallback engaged."
    if "NOT_FOUND" in upper or "404" in upper:
        return "Gemini model not found (404). Try gemini-2.5-flash-lite or gemini-2.5-flash."
    if "PERMISSION_DENIED" in upper or "403" in upper:
        return "Gemini access was denied. Check API key permissions; local fallback engaged."
    if "UNAUTHENTICATED" in upper or "401" in upper:
        return "Gemini authentication failed. Check the API key; local fallback engaged."
    if "DEADLINE_EXCEEDED" in upper or "TIMEOUT" in upper:
        return "Gemini request timed out. Local autonomous fallback engaged."

    first_line = raw.splitlines()[0] if raw else "Unknown LLM error."
    return first_line[:220]


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                text = item.strip()
            elif isinstance(item, dict):
                text = str(item.get("text", "")).strip()
            else:
                text = str(item).strip()

            if text:
                parts.append(text)
        return "\n".join(parts).strip()

    return str(content).strip()


@lru_cache(maxsize=8)
def _build_model(model_name: str) -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    if not api_key:
        raise AgentLLMError(
            "Missing GEMINI_API_KEY/GOOGLE_API_KEY for the LangGraph AI agent."
        )

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
    except ImportError as exc:
        raise AgentLLMError(
            "langchain-google-genai is not installed for the LangGraph AI agent."
        ) from exc

    return {
        "provider": "gemini",
        "model": model_name,
        "llm": ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=0.1,
            max_retries=0,
        ),
    }


def get_ai_status() -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    model_candidates = _model_candidates()

    status = {
        "provider": "gemini",
        "model": model_candidates[0] if model_candidates else None,
        "model_candidates": model_candidates,
        "configured": bool(api_key),
        "cooldown_seconds": _cooldown_remaining(),
    }

    if not api_key:
        status["error"] = "Missing GEMINI_API_KEY/GOOGLE_API_KEY"
        return status

    try:
        _build_model(model_candidates[0])
        status["ready"] = True
    except Exception as exc:
        status["ready"] = False
        status["error"] = str(exc)

    return status


def generate_text(prompt: str, *, task_name: str) -> str:
    cooldown_seconds = _cooldown_remaining()
    if cooldown_seconds > 0:
        raise AgentLLMError(
            f"Gemini cooldown active for {cooldown_seconds}s after a rate limit. Local autonomous fallback engaged."
        )

    last_error: Exception | None = None
    for model_name in _model_candidates():
        model_config = _build_model(model_name)
        try:
            response = model_config["llm"].invoke(prompt)
            text = _extract_text(getattr(response, "content", response))
        except Exception as exc:
            last_error = exc
            normalized = _normalize_error_message(exc)

            if "429" in normalized:
                cooldown_seconds = int(os.getenv("RAKSHAK_GEMINI_COOLDOWN_SECONDS", "75"))
                _set_cooldown(cooldown_seconds)
                raise AgentLLMError(normalized) from exc

            if "404" in normalized and model_name != _model_candidates()[-1]:
                continue

            raise AgentLLMError(normalized) from exc

        if not text:
            last_error = AgentLLMError(
                f"{model_config['provider']}:{model_config['model']} returned an empty response "
                f"during {task_name}."
            )
            continue

        return text

    if last_error:
        raise AgentLLMError(_normalize_error_message(last_error)) from last_error

    raise AgentLLMError("Gemini request failed before a model response was returned.")
