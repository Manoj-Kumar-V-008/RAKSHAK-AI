import os
from functools import lru_cache
from typing import Any


class AgentLLMError(RuntimeError):
    """Raised when the configured LLM cannot be used."""


def _normalize_error_message(exc: Exception) -> str:
    raw = str(exc).strip()
    upper = raw.upper()

    if "RESOURCE_EXHAUSTED" in upper or "429" in upper:
        return "Gemini quota exhausted (429). Local autonomous fallback engaged."
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


@lru_cache(maxsize=1)
def _build_model() -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    model_name = (
        os.getenv("RAKSHAK_GEMINI_MODEL")
        or os.getenv("GEMINI_MODEL")
        or "gemini-2.0-flash"
    )

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
            max_retries=2,
        ),
    }


def get_ai_status() -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    model_name = (
        os.getenv("RAKSHAK_GEMINI_MODEL")
        or os.getenv("GEMINI_MODEL")
        or "gemini-2.0-flash"
    )

    status = {
        "provider": "gemini",
        "model": model_name,
        "configured": bool(api_key),
    }

    if not api_key:
        status["error"] = "Missing GEMINI_API_KEY/GOOGLE_API_KEY"
        return status

    try:
        _build_model()
        status["ready"] = True
    except Exception as exc:
        status["ready"] = False
        status["error"] = str(exc)

    return status


def generate_text(prompt: str, *, task_name: str) -> str:
    model_config = _build_model()
    try:
        response = model_config["llm"].invoke(prompt)
        text = _extract_text(getattr(response, "content", response))
    except Exception as exc:
        raise AgentLLMError(_normalize_error_message(exc)) from exc

    if not text:
        raise AgentLLMError(
            f"{model_config['provider']}:{model_config['model']} returned an empty response "
            f"during {task_name}."
        )

    return text
