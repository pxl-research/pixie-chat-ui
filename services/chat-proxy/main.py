import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from starlette.responses import StreamingResponse

app = FastAPI()
logger = logging.getLogger("audit")

DEFAULT_CORS_ALLOW_ORIGINS = "http://localhost:3000"
DEFAULT_BACKEND_TARGET = "recommender"
DEFAULT_LANDING_TITLE = "Welkom bij onze AI-assistent"
DEFAULT_LANDING_RESEARCH_NOTE = (
    "Deze AI-assistent maakt deel uit van een TETRA-onderzoeksproject. De antwoorden zijn experimenteel en kunnen onvolledig of onjuist zijn."
)
DEFAULT_LANDING_PRIVACY_NOTE = (
    "We vragen of bewaren geen persoonsgegevens. Anonieme gebruiksgegevens worden verzameld om het onderzoek te verbeteren, met respect voor de GDPR-richtlijnen."
)


def _normalize_url(raw: str) -> str:
    return raw.strip().rstrip("/")


def _parse_origins(raw: str) -> list[str]:
    if raw.strip() == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _get_required_url(env_name: str, default: str | None = None) -> str:
    """Fetch and normalize a required URL env variable, with an optional default."""
    normalized = _normalize_url(os.environ.get(env_name, default or ""))
    if not normalized:
        raise RuntimeError(f"{env_name} environment variable is required")
    return normalized


def _parse_landing_presets(raw: str) -> list[dict[str, str]]:
    """Parse pipe-delimited landing presets; each item can be label or label=prefill."""
    presets: list[dict[str, str]] = []
    for item in raw.split("|"):
        token = item.strip()
        if not token:
            continue
        if "=" in token:
            label, prefill = token.split("=", 1)
        else:
            label, prefill = token, token
        label = label.strip()
        prefill = prefill.strip()
        if not label:
            continue
        presets.append({"label": label, "prefill": prefill or label})
    return presets


def _parse_bool(raw: str) -> bool:
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _get_int_env(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _safe_json_loads(raw: bytes) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    try:
        payload = json.loads(raw)
    except ValueError:
        return None
    if isinstance(payload, dict):
        return payload
    return None


def _extract_user_text(payload: Optional[Dict[str, Any]]) -> Optional[str]:
    if not payload:
        return None
    for key in ("current_answer", "currentAnswer", "input", "user_input", "message", "question", "text"):
        value = payload.get(key)
        if isinstance(value, str):
            text = value.strip()
            if text:
                return text
    return None


def _extract_assistant_text(payload: Optional[Dict[str, Any]]) -> Optional[str]:
    if not payload:
        return None
    for key in ("text", "answer", "message", "detail"):
        value = payload.get(key)
        if isinstance(value, str):
            text = value.strip()
            if text:
                return text
    return None


def _extract_summary_text(payload: Optional[Dict[str, Any]]) -> Optional[str]:
    if not payload:
        return None
    for key in ("summary", "summary_text", "summaryText"):
        value = payload.get(key)
        if isinstance(value, str):
            text = value.strip()
            if text:
                return text
    return None


def _extract_conversation_id(payload: Optional[Dict[str, Any]]) -> Optional[str]:
    if not payload:
        return None
    for key in ("conversationId", "conversation_id", "session_id", "sessionId"):
        value = payload.get(key)
        if isinstance(value, str):
            text = value.strip()
            if text:
                return text
    return None


def _resolve_conversation_id(
    request: Request,
    request_payload: Optional[Dict[str, Any]],
    response_payload: Optional[Dict[str, Any]],
) -> str:
    header_value = request.headers.get("X-Conversation-Id")
    if header_value and header_value.strip():
        return header_value.strip()
    if request_payload:
        conversation_id = _extract_conversation_id(request_payload)
        if conversation_id:
            return conversation_id
    if response_payload:
        conversation_id = _extract_conversation_id(response_payload)
        if conversation_id:
            return conversation_id
    return str(uuid4())


def _build_audit_metadata(
    request: Request,
    response: Any,
    latency_ms: int,
    response_payload: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    request_id = request.headers.get("X-Request-Id") or request.headers.get("X-Request-ID")
    metadata: Dict[str, Any] = {
        "request_id": request_id,
        "route": request.url.path,
        "status_code": response.status_code,
        "latency_ms": latency_ms,
    }
    if response_payload:
        prompt = response_payload.get("prompt")
        if isinstance(prompt, str) and prompt.strip():
            metadata["prompt"] = prompt
        model = response_payload.get("model")
        if isinstance(model, str) and model.strip():
            metadata["model"] = model
    return {key: value for key, value in metadata.items() if value is not None}


CORS_ALLOW_ORIGINS = os.environ.get("CORS_ALLOW_ORIGINS", DEFAULT_CORS_ALLOW_ORIGINS)
ALLOWED_ORIGINS = _parse_origins(CORS_ALLOW_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    if not AUDIT_LOGGING_ENABLED:
        return await call_next(request)
    if request.method.upper() != "POST" or request.url.path != "/chat":
        return await call_next(request)

    request_body = await request.body()
    request_payload = _safe_json_loads(request_body)

    start = time.perf_counter()
    response = await call_next(request)
    latency_ms = int((time.perf_counter() - start) * 1000)

    if isinstance(response, StreamingResponse):
        conversation_id = _resolve_conversation_id(request, request_payload, None)
        response.headers["X-Conversation-Id"] = conversation_id
        return response

    response_body = getattr(response, "body", b"") or b""
    response_payload = _safe_json_loads(response_body)

    conversation_id = _resolve_conversation_id(request, request_payload, response_payload)
    response.headers["X-Conversation-Id"] = conversation_id

    user_text = _extract_user_text(request_payload)
    assistant_text = _extract_assistant_text(response_payload)
    summary_text = _extract_summary_text(response_payload)
    response_type = response_payload.get("type") if response_payload else None
    if response_type == "summary":
        if summary_text:
            if response_payload:
                text_value = response_payload.get("text")
                if isinstance(text_value, str):
                    text_value = text_value.strip()
                    if text_value:
                        assistant_text = text_value
        else:
            if assistant_text:
                summary_text = assistant_text
            assistant_text = None
    elif assistant_text is None and response_body:
        try:
            decoded = response_body.decode("utf-8").strip()
        except UnicodeDecodeError:
            decoded = ""
        if decoded:
            assistant_text = decoded

    metadata = _build_audit_metadata(request, response, latency_ms, response_payload)

    payloads = _build_audit_payloads(
        conversation_id=conversation_id,
        profile=PIXIE_PROFILE,
        user_text=user_text,
        assistant_text=assistant_text,
        summary_text=summary_text,
        metadata=metadata,
    )
    if _audit_client is not None and payloads:
        asyncio.create_task(_send_audit_payloads(payloads, conversation_id=conversation_id))
    return response

# Determine target backend (recommender, informer, questioner)
PIXIE_BACKEND_TARGET = (os.environ.get("PIXIE_BACKEND_TARGET") or DEFAULT_BACKEND_TARGET).strip().lower()

if PIXIE_BACKEND_TARGET not in {"recommender", "informer", "questioner"}:
    raise RuntimeError("PIXIE_BACKEND_TARGET must be either 'recommender', 'informer', or 'questioner'")

PIXIE_CORE_API_BASE_URL: str = _get_required_url("PIXIE_CORE_API_BASE_URL", "http://recommender-api:8000")
PIXIE_INFORMER_API_BASE_URL: str = _get_required_url("PIXIE_INFORMER_API_BASE_URL", "http://informer-api:8000")
PIXIE_QUESTIONER_API_BASE_URL: str = _get_required_url("PIXIE_QUESTIONER_API_BASE_URL", "http://questioner-api:8000")

_client_id = os.environ.get("ACTIVE_CLIENT_ID")
if not _client_id:
    raise RuntimeError("ACTIVE_CLIENT_ID environment variable is required")
ACTIVE_CLIENT_ID: str = _client_id

PIXIE_API_KEY = os.environ.get("PIXIE_API_KEY")
BACKEND_BASE_URLS: Dict[str, str] = {
    "recommender": PIXIE_CORE_API_BASE_URL,
    "informer": PIXIE_INFORMER_API_BASE_URL,
    "questioner": PIXIE_QUESTIONER_API_BASE_URL,
}
BACKEND_BASE_URL: str = BACKEND_BASE_URLS[PIXIE_BACKEND_TARGET]

PIXIE_PROFILE = (os.environ.get("PIXIE_PROFILE") or PIXIE_BACKEND_TARGET).strip().lower()

AUDIT_LOGGING_ENABLED = _parse_bool(os.environ.get("AUDIT_LOGGING_ENABLED", "false"))
AUDIT_API_URL = _normalize_url(os.environ.get("AUDIT_API_URL", ""))
AUDIT_API_KEY = os.environ.get("AUDIT_API_KEY", "").strip()
AUDIT_LOG_TIMEOUT_MS = max(0, _get_int_env("AUDIT_LOG_TIMEOUT_MS", 250))

HEALTH_PATH = "/health"
HEALTH_CACHE_SECONDS = 15

BackendHealth = Dict[str, Optional[Any]]
_backend_health: BackendHealth = {"status": "unknown", "detail": None, "checked_at": None}
_http_client: Optional[httpx.AsyncClient] = None
_audit_client: Optional[httpx.AsyncClient] = None


def build_client_payload() -> Dict[str, Any]:
    """Build client configuration from environment variables."""
    theme: Dict[str, str] = {}
    chat_header: Dict[str, str] = {}

    # Add theme properties if defined
    if primary_color := os.environ.get("ACTIVE_CLIENT_PRIMARY_COLOR"):
        theme["primaryColor"] = primary_color
    if logo_url := os.environ.get("ACTIVE_CLIENT_LOGO_URL"):
        theme["logoUrl"] = logo_url
    if bg_image := os.environ.get("ACTIVE_CLIENT_BACKGROUND_IMAGE_URL"):
        theme["backgroundImageUrl"] = bg_image

    if chat_header_title := os.environ.get("ACTIVE_CLIENT_CHAT_HEADER_TITLE"):
        chat_header["title"] = chat_header_title
    if chat_header_logo_url := os.environ.get("ACTIVE_CLIENT_CHAT_HEADER_LOGO_URL"):
        chat_header["logoUrl"] = chat_header_logo_url
    if "logoUrl" not in chat_header:
        if logo_no_text_url := os.environ.get("ACTIVE_CLIENT_LOGO_NO_TEXT_URL"):
            chat_header["logoUrl"] = logo_no_text_url

    payload = {
        "id": ACTIVE_CLIENT_ID,
        "displayName": os.environ.get("ACTIVE_CLIENT_DISPLAY_NAME", ACTIVE_CLIENT_ID),
        "theme": theme,
        "welcomeMessage": os.environ.get("ACTIVE_CLIENT_WELCOME_MESSAGE"),
        "landing": {
            "title": os.environ.get("LANDING_TITLE", DEFAULT_LANDING_TITLE),
            "researchNote": os.environ.get("LANDING_RESEARCH_NOTE", DEFAULT_LANDING_RESEARCH_NOTE),
            "privacyNote": os.environ.get("LANDING_PRIVACY_NOTE", DEFAULT_LANDING_PRIVACY_NOTE),
            "startLabel": os.environ.get("LANDING_START_LABEL", "Start assistent"),
            "presets": _parse_landing_presets(os.environ.get("LANDING_PRESETS", "")),
        },
    }

    if chat_header:
        payload["chatHeader"] = chat_header

    return payload


@app.get("/client")
async def client() -> Dict[str, Any]:
    """Expose active client branding and identifiers to the UI."""
    return build_client_payload()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _build_audit_payloads(
    *,
    conversation_id: str,
    profile: str,
    user_text: Optional[str],
    assistant_text: Optional[str],
    summary_text: Optional[str],
    metadata: Dict[str, Any],
) -> list[Dict[str, Any]]:
    payloads: list[Dict[str, Any]] = []
    base: Dict[str, Any] = {
        "conversation_id": conversation_id,
        "profile": profile,
        "metadata": metadata,
    }
    if user_text is not None:
        payloads.append(
            {
                **base,
                "messages": [
                    {
                        "role": "user",
                        "content": user_text,
                        "metadata": metadata,
                    }
                ],
            }
        )
    if assistant_text is not None:
        payloads.append(
            {
                **base,
                "messages": [
                    {
                        "role": "assistant",
                        "content": assistant_text,
                        "metadata": metadata,
                    }
                ],
            }
        )
    if summary_text is not None:
        payloads.append({**base, "summary": summary_text})
    return payloads


async def _send_audit_payloads(
    payloads: list[Dict[str, Any]],
    *,
    conversation_id: str,
) -> None:
    if _audit_client is None or not payloads:
        return
    headers = {"Content-Type": "application/json"}
    if AUDIT_API_KEY:
        headers["X-API-Key"] = AUDIT_API_KEY
    timeout = AUDIT_LOG_TIMEOUT_MS / 1000.0 if AUDIT_LOG_TIMEOUT_MS else None

    for payload in payloads:
        try:
            response = await _audit_client.post("/events", json=payload, headers=headers, timeout=timeout)
            if response.status_code >= 400:
                logger.warning(
                    "Audit API rejected event",
                    extra={"conversation_id": conversation_id, "status_code": response.status_code},
                )
        except httpx.HTTPError:
            logger.exception("Audit API request failed", extra={"conversation_id": conversation_id})


async def get_http_client() -> httpx.AsyncClient:
    if _http_client is None:
        raise RuntimeError("HTTP client not initialized")
    return _http_client


async def refresh_backend_health(force: bool = False) -> BackendHealth:
    """Check backend /health endpoint and cache the result briefly."""
    global _backend_health
    if (
        not force
        and _backend_health["checked_at"]
        and (_now() - _backend_health["checked_at"]) < timedelta(seconds=HEALTH_CACHE_SECONDS)  # type: ignore[operator]
    ):
        return _backend_health

    try:
        client = await get_http_client()
        response = await client.get(HEALTH_PATH, timeout=3.0)
        response.raise_for_status()
        _backend_health = {
            "status": "healthy",
            "detail": None,
            "checked_at": _now(),
        }
    except httpx.HTTPError as exc:
        _backend_health = {
            "status": "unhealthy",
            "detail": f"Health check failed: {exc}",
            "checked_at": _now(),
        }

    return _backend_health


async def ensure_backend_ready() -> None:
    state = await refresh_backend_health()
    if state["status"] != "healthy":
        raise HTTPException(status_code=503, detail=state["detail"] or "Configured Pixie backend is not reachable.")


@app.on_event("startup")
async def startup_check() -> None:
    global _audit_client, _http_client
    _http_client = httpx.AsyncClient(base_url=BACKEND_BASE_URL, timeout=30.0)
    await refresh_backend_health(force=True)
    if AUDIT_LOGGING_ENABLED and AUDIT_API_URL:
        try:
            _audit_client = httpx.AsyncClient(base_url=AUDIT_API_URL)
        except Exception:
            logger.exception("Failed to initialize audit logging client")
            _audit_client = None
    elif AUDIT_LOGGING_ENABLED:
        logger.warning(
            "AUDIT_LOGGING_ENABLED is true but AUDIT_API_URL is not set; audit logging disabled."
        )


@app.on_event("shutdown")
async def shutdown_client() -> None:
    global _audit_client, _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None
    if _audit_client is not None:
        await _audit_client.aclose()
        _audit_client = None


@app.get("/health")
async def health() -> Dict[str, Any]:
    state = await refresh_backend_health()
    return {
        "status": state["status"],
        "targetBackend": PIXIE_BACKEND_TARGET,
        "backendUrl": BACKEND_BASE_URL,
        "detail": state["detail"],
        "checkedAt": state["checked_at"].isoformat() if state["checked_at"] else None,
    }


async def call_pixie(payload: Dict[str, Any]) -> Dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    if PIXIE_API_KEY:
        headers["Authorization"] = f"Bearer {PIXIE_API_KEY}"

    client = await get_http_client()
    try:
        response = await client.post("/chat", json=payload, headers=headers)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        try:
            detail = exc.response.json()
        except ValueError:
            detail = exc.response.text
        raise HTTPException(
            status_code=exc.response.status_code, detail=detail
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail=f"Error reaching Pixie Core: {exc}"
        ) from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502, detail="Invalid JSON received from Pixie Core"
        ) from exc

    if not isinstance(data, dict):
        raise HTTPException(
            status_code=502, detail="Unexpected response format from Pixie Core"
        )

    return data


class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    session_id: str | None = None
    current_answer: str | None = None
    state: Dict[str, Any] | None = None
    user_input: str | None = Field(default=None, alias="input")
    conversation_id: str | None = Field(default=None, alias="conversationId")
    history: List[str] | None = None


async def call_qa_backend(
    current_answer: str,
    session_id: str,
    state: Dict[str, Any],
    history: List[str] | None,
) -> Dict[str, Any]:
    """Forward chat request to the QA backend `/chat` endpoint."""
    payload = {
        "session_id": session_id,
        "current_answer": current_answer,
        "state": state,
        "question": current_answer,
    }
    if history:
        payload["history"] = history

    client = await get_http_client()
    try:
        response = await client.post("/chat", json=payload)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        try:
            detail = exc.response.json()
        except ValueError:
            detail = exc.response.text
        raise HTTPException(
            status_code=exc.response.status_code, detail=detail
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail=f"Error reaching Pixie {PIXIE_BACKEND_TARGET}: {exc}"
        ) from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502, detail="Invalid JSON received from Pixie Informer"
        ) from exc

    if not isinstance(data, dict):
        raise HTTPException(
            status_code=502, detail="Unexpected response format from Pixie Informer"
        )

    return data


def _normalize_chat_response(
    data: Dict[str, Any],
    session_id: str,
    fallback_state: Dict[str, Any],
) -> Dict[str, Any]:
    """Normalize backend responses to the UI contract."""
    response_type = data.get("type")
    if not isinstance(response_type, str):
        response_type = "summary" if _extract_summary_text(data) else "answer"

    text = data.get("text")
    if not isinstance(text, str) or not text.strip():
        text = data.get("answer")
    if (not isinstance(text, str) or not text.strip()) and response_type == "ask_user":
        text = data.get("prompt")
    if (not isinstance(text, str) or not text.strip()) and response_type == "error":
        text = data.get("reason")
    if not isinstance(text, str) or not text.strip():
        text = data.get("prompt") or data.get("reason") or data.get("summary") or ""

    state = data.get("state")
    if not isinstance(state, dict):
        state = fallback_state

    response: Dict[str, Any] = {
        "type": response_type or "answer",
        "text": text,
        "conversation_id": data.get("conversation_id")
        or data.get("conversationId")
        or session_id,
        "state": state,
    }
    summary_text = _extract_summary_text(data)
    if response_type == "summary" and summary_text:
        response["summary"] = summary_text
    return response


@app.post("/chat")
async def chat(payload: ChatRequest) -> Dict[str, Any]:
    """Forward chat request to the configured Pixie backend for the active client."""
    current_answer = (payload.current_answer or payload.user_input or "").strip()
    if not current_answer:
        raise HTTPException(status_code=400, detail="Input may not be empty.")

    await ensure_backend_ready()

    if PIXIE_BACKEND_TARGET in {"informer", "questioner"}:
        session_id = payload.session_id or payload.conversation_id or str(uuid4())
        state = payload.state if isinstance(payload.state, dict) else {}
        qa_response = await call_qa_backend(
            current_answer=current_answer,
            session_id=session_id,
            state=state,
            history=payload.history,
        )
        return _normalize_chat_response(qa_response, session_id, state)

    has_session = bool(payload.session_id or payload.conversation_id)
    session_id = payload.session_id or payload.conversation_id or str(uuid4())
    state = payload.state if isinstance(payload.state, dict) else {}
    if has_session:
        pixie_payload = {"conversation_id": session_id, "message": current_answer}
    else:
        pixie_payload = {"question": current_answer}
    pixie_payload.update(
        {
            "session_id": session_id,
            "current_answer": current_answer,
            "state": state,
        }
    )

    pixie_response = await call_pixie(pixie_payload)

    return _normalize_chat_response(pixie_response, session_id, state)
