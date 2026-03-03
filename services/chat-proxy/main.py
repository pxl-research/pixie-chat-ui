import os
import json
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, model_validator
import logging

logger = logging.getLogger(__name__)

app = FastAPI()

DEFAULT_CORS_ALLOW_ORIGINS = "http://localhost:3000"
DEFAULT_BACKEND_TARGET = "recommender"
DEFAULT_CHAT_CONTRACT_VERSION = "chat-v2.0.0"
DEFAULT_LANDING_TITLE = "Welkom bij onze AI-assistent"
DEFAULT_LANDING_RESEARCH_NOTE = (
    "Deze AI-assistent maakt deel uit van een TETRA-onderzoeksproject. De antwoorden zijn experimenteel en kunnen onvolledig of onjuist zijn."
)
DEFAULT_LANDING_PRIVACY_NOTE = (
    "We vragen of bewaren geen persoonsgegevens. Anonieme gebruiksgegevens worden verzameld om het onderzoek te verbeteren, met respect voor de GDPR-richtlijnen."
)
MAX_LOCATION_LENGTH = 120
MAX_CHAT_INPUT_CHARS = 600
MAX_CHAT_STATE_BYTES = 16_000
MAX_CHAT_HISTORY_ITEMS = 12
MAX_CHAT_HISTORY_ENTRY_CHARS = 320
RATE_LIMIT_PER_MINUTE = 24
RATE_LIMIT_PER_HOUR = 240
RATE_LIMIT_BLOCK_SECONDS = 300
SESSION_IDLE_TIMEOUT_SECONDS = 900
SESSION_TRACKING_TTL_SECONDS = 86_400


def _parse_bool(raw: str, default: bool = False) -> bool:
    if not raw:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _parse_int(raw: str | None, default: int, minimum: int) -> int:
    if raw is None or not raw.strip():
        return default
    try:
        parsed = int(raw.strip())
    except ValueError:
        return default
    if parsed < minimum:
        return minimum
    return parsed


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


def _normalize_location_value(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = " ".join(value.split())
    if not normalized:
        return None
    if len(normalized) > MAX_LOCATION_LENGTH:
        return normalized[:MAX_LOCATION_LENGTH]
    return normalized


def _parse_allowed_locations(raw: str) -> list[str]:
    normalized_raw = raw.replace("|", ",")
    allowed: list[str] = []
    seen: set[str] = set()
    for token in normalized_raw.split(","):
        normalized = _normalize_location_value(token)
        if not normalized:
            continue
        key = normalized.casefold()
        if key in seen:
            continue
        seen.add(key)
        allowed.append(normalized)
    return allowed


def _normalize_state_location(
    state: Dict[str, Any],
    *,
    strict: bool,
) -> Dict[str, Any]:
    normalized_state = dict(state)
    if "location" not in normalized_state:
        if strict and ACTIVE_CLIENT_ALLOWED_LOCATION_LOOKUP:
            raise HTTPException(status_code=400, detail="Missing location.")
        return normalized_state

    normalized_location = _normalize_location_value(normalized_state.get("location"))
    if normalized_location is None:
        if strict and ACTIVE_CLIENT_ALLOWED_LOCATION_LOOKUP:
            raise HTTPException(status_code=400, detail="Missing location.")
        normalized_state.pop("location", None)
        return normalized_state

    if ACTIVE_CLIENT_ALLOWED_LOCATION_LOOKUP:
        allowed_location = ACTIVE_CLIENT_ALLOWED_LOCATION_LOOKUP.get(
            normalized_location.casefold()
        )
        if allowed_location is None:
            if strict:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid location.",
                )
            normalized_state.pop("location", None)
            return normalized_state
        normalized_location = allowed_location

    normalized_state["location"] = normalized_location
    return normalized_state


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


def _extract_follow_up_question(payload: Optional[Dict[str, Any]]) -> Optional[str]:
    if not payload:
        return None
    for key in (
        "follow_up_question",
        "followUpQuestion",
        "next_question",
        "nextQuestion",
        "prompt",
        "question",
    ):
        value = payload.get(key)
        if isinstance(value, str):
            text = value.strip()
            if text:
                return text
    return None


def _normalize_quick_reply_text(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = " ".join(value.split())
    if not normalized:
        return None
    return normalized


def _normalize_quick_reply_options(raw_options: Any) -> Optional[List[Dict[str, str]]]:
    if not isinstance(raw_options, list):
        return None

    normalized_options: List[Dict[str, str]] = []
    seen_values: set[str] = set()

    for item in raw_options:
        label: Optional[str]
        value: Optional[str]

        if isinstance(item, str):
            label = _normalize_quick_reply_text(item)
            value = label
        elif isinstance(item, dict):
            label = _normalize_quick_reply_text(item.get("label"))
            if label is None:
                label = _normalize_quick_reply_text(item.get("text"))
            value = _normalize_quick_reply_text(item.get("value"))
            if value is None:
                value = label
        else:
            continue

        if label is None or value is None:
            continue

        dedupe_key = value.casefold()
        if dedupe_key in seen_values:
            continue

        seen_values.add(dedupe_key)
        normalized_options.append({"label": label, "value": value})

        if len(normalized_options) >= 6:
            break

    if not normalized_options:
        return None
    return normalized_options


def _normalize_quick_replies(
    payload: Optional[Dict[str, Any]],
    state: Optional[Dict[str, Any]],
) -> Optional[List[Dict[str, str]]]:
    keys = (
        "quick_replies",
        "quickReplies",
        "choices",
        "options",
        "suggested_answers",
    )
    for source in (payload, state):
        if not source:
            continue
        for key in keys:
            normalized = _normalize_quick_reply_options(source.get(key))
            if normalized:
                return normalized
    return None


CORS_ALLOW_ORIGINS = os.environ.get("CORS_ALLOW_ORIGINS", DEFAULT_CORS_ALLOW_ORIGINS)
ALLOWED_ORIGINS = _parse_origins(CORS_ALLOW_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Determine target backend (recommender, informer, questioner)
PIXIE_BACKEND_TARGET = (os.environ.get("PIXIE_BACKEND_TARGET") or DEFAULT_BACKEND_TARGET).strip().lower()
PIXIE_CHAT_CONTRACT_VERSION = (
    os.environ.get("PIXIE_CHAT_CONTRACT_VERSION") or DEFAULT_CHAT_CONTRACT_VERSION
).strip()
STRICT_QUESTIONER_CHAT_CONTRACT = _parse_bool(
    os.environ.get("STRICT_QUESTIONER_CHAT_CONTRACT", "true"), default=True
)

if PIXIE_BACKEND_TARGET not in {"recommender", "informer", "questioner"}:
    raise RuntimeError("PIXIE_BACKEND_TARGET must be either 'recommender', 'informer', or 'questioner'")

PIXIE_CORE_API_BASE_URL: str = _get_required_url("PIXIE_CORE_API_BASE_URL", "http://recommender-api:8000")
PIXIE_INFORMER_API_BASE_URL: str = _get_required_url("PIXIE_INFORMER_API_BASE_URL", "http://informer-api:8000")
PIXIE_QUESTIONER_API_BASE_URL: str = _get_required_url("PIXIE_QUESTIONER_API_BASE_URL", "http://questioner-api:8000")

_client_id = os.environ.get("ACTIVE_CLIENT_ID")
if not _client_id:
    raise RuntimeError("ACTIVE_CLIENT_ID environment variable is required")
ACTIVE_CLIENT_ID: str = _client_id

ACTIVE_CLIENT_ALLOWED_LOCATIONS = _parse_allowed_locations(
    os.environ.get("ACTIVE_CLIENT_ALLOWED_LOCATIONS", "")
)
ACTIVE_CLIENT_ALLOWED_LOCATION_LOOKUP = {
    location.casefold(): location for location in ACTIVE_CLIENT_ALLOWED_LOCATIONS
}
ACTIVE_CLIENT_DEBUG_TOGGLE_ENABLED = _parse_bool(
    os.environ.get("ACTIVE_CLIENT_DEBUG_TOGGLE_ENABLED", "false"),
    default=False,
)
ACTIVE_CLIENT_DEBUG_DEFAULT_ENABLED = _parse_bool(
    os.environ.get("ACTIVE_CLIENT_DEBUG_DEFAULT_ENABLED", "false"),
    default=False,
)

PIXIE_API_KEY = os.environ.get("PIXIE_API_KEY")
MAX_CHAT_INPUT_CHARS = _parse_int(
    os.environ.get("MAX_CHAT_INPUT_CHARS"),
    MAX_CHAT_INPUT_CHARS,
    minimum=80,
)
MAX_CHAT_STATE_BYTES = _parse_int(
    os.environ.get("MAX_CHAT_STATE_BYTES"),
    MAX_CHAT_STATE_BYTES,
    minimum=1024,
)
MAX_CHAT_HISTORY_ITEMS = _parse_int(
    os.environ.get("MAX_CHAT_HISTORY_ITEMS"),
    MAX_CHAT_HISTORY_ITEMS,
    minimum=1,
)
MAX_CHAT_HISTORY_ENTRY_CHARS = _parse_int(
    os.environ.get("MAX_CHAT_HISTORY_ENTRY_CHARS"),
    MAX_CHAT_HISTORY_ENTRY_CHARS,
    minimum=40,
)
RATE_LIMIT_PER_MINUTE = _parse_int(
    os.environ.get("RATE_LIMIT_PER_MINUTE"),
    RATE_LIMIT_PER_MINUTE,
    minimum=1,
)
RATE_LIMIT_PER_HOUR = _parse_int(
    os.environ.get("RATE_LIMIT_PER_HOUR"),
    RATE_LIMIT_PER_HOUR,
    minimum=RATE_LIMIT_PER_MINUTE,
)
RATE_LIMIT_BLOCK_SECONDS = _parse_int(
    os.environ.get("RATE_LIMIT_BLOCK_SECONDS"),
    RATE_LIMIT_BLOCK_SECONDS,
    minimum=1,
)
SESSION_IDLE_TIMEOUT_SECONDS = _parse_int(
    os.environ.get("SESSION_IDLE_TIMEOUT_SECONDS"),
    SESSION_IDLE_TIMEOUT_SECONDS,
    minimum=30,
)
BACKEND_BASE_URLS: Dict[str, str] = {
    "recommender": PIXIE_CORE_API_BASE_URL,
    "informer": PIXIE_INFORMER_API_BASE_URL,
    "questioner": PIXIE_QUESTIONER_API_BASE_URL,
}
BACKEND_BASE_URL: str = BACKEND_BASE_URLS[PIXIE_BACKEND_TARGET]

HEALTH_PATH = "/health"
HEALTH_CACHE_SECONDS = 15

BackendHealth = Dict[str, Optional[Any]]
_backend_health: BackendHealth = {"status": "unknown", "detail": None, "checked_at": None}
_http_client: Optional[httpx.AsyncClient] = None
_minute_window_by_client: dict[str, deque[datetime]] = defaultdict(deque)
_hour_window_by_client: dict[str, deque[datetime]] = defaultdict(deque)
_blocked_until_by_client: dict[str, datetime] = {}
_session_last_seen_by_id: dict[str, datetime] = {}


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
        "debug": {
            "toggleEnabled": ACTIVE_CLIENT_DEBUG_TOGGLE_ENABLED,
            "defaultEnabled": ACTIVE_CLIENT_DEBUG_DEFAULT_ENABLED,
        },
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

    if ACTIVE_CLIENT_ALLOWED_LOCATIONS:
        payload["allowedLocations"] = ACTIVE_CLIENT_ALLOWED_LOCATIONS

    return payload


@app.get("/client")
async def client() -> Dict[str, Any]:
    """Expose active client branding and identifiers to the UI."""
    return build_client_payload()


def _now() -> datetime:
    return datetime.now(timezone.utc)


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
        # Log detailed exception server-side but avoid exposing it via the public API.
        logger.warning("Backend health check failed", exc_info=exc)
        _backend_health = {
            "status": "unhealthy",
            "detail": "Health check failed",
            "checked_at": _now(),
        }

    return _backend_health


async def ensure_backend_ready() -> None:
    state = await refresh_backend_health()
    if state["status"] != "healthy":
        raise HTTPException(status_code=503, detail=state["detail"] or "Configured Pixie backend is not reachable.")


def _prune_window(entries: deque[datetime], cutoff: datetime) -> None:
    while entries and entries[0] < cutoff:
        entries.popleft()


def _resolve_client_key(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        client_ip = forwarded_for.split(",", maxsplit=1)[0].strip()
    elif request.client is not None:
        client_ip = request.client.host
    else:
        client_ip = "unknown"

    location_code = (
        request.cookies.get("pixie_loc_code")
        or request.headers.get("x-pixie-location-code", "").strip()
        or "-"
    )
    return f"{client_ip}|{location_code}"


def _cleanup_tracking(now: datetime) -> None:
    stale_cutoff = now - timedelta(seconds=SESSION_TRACKING_TTL_SECONDS)
    for session_id, seen_at in list(_session_last_seen_by_id.items()):
        if seen_at < stale_cutoff:
            _session_last_seen_by_id.pop(session_id, None)

    for client_key, blocked_until in list(_blocked_until_by_client.items()):
        if blocked_until <= now:
            _blocked_until_by_client.pop(client_key, None)

    minute_cutoff = now - timedelta(minutes=1)
    for client_key, window in list(_minute_window_by_client.items()):
        _prune_window(window, minute_cutoff)
        if not window:
            _minute_window_by_client.pop(client_key, None)

    hour_cutoff = now - timedelta(hours=1)
    for client_key, window in list(_hour_window_by_client.items()):
        _prune_window(window, hour_cutoff)
        if not window:
            _hour_window_by_client.pop(client_key, None)


def _enforce_payload_limits(current_answer: str, state: Dict[str, Any], history: List[str] | None) -> List[str] | None:
    if len(current_answer) > MAX_CHAT_INPUT_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Input exceeds maximum length ({MAX_CHAT_INPUT_CHARS} chars).",
        )

    try:
        serialized_state = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid state payload.") from exc

    state_size = len(serialized_state.encode("utf-8"))
    if state_size > MAX_CHAT_STATE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"State exceeds maximum size ({MAX_CHAT_STATE_BYTES} bytes).",
        )

    if not history:
        return None

    if len(history) > MAX_CHAT_HISTORY_ITEMS:
        raise HTTPException(
            status_code=413,
            detail=f"History exceeds maximum item count ({MAX_CHAT_HISTORY_ITEMS}).",
        )

    sanitized_history: list[str] = []
    for item in history:
        normalized = " ".join(item.split())
        if not normalized:
            continue
        if len(normalized) > MAX_CHAT_HISTORY_ENTRY_CHARS:
            raise HTTPException(
                status_code=413,
                detail=(
                    "History entry exceeds maximum length "
                    f"({MAX_CHAT_HISTORY_ENTRY_CHARS} chars)."
                ),
            )
        sanitized_history.append(normalized)

    return sanitized_history or None


def _enforce_abuse_limits(request: Request, session_id: str) -> None:
    now = _now()
    _cleanup_tracking(now)
    client_key = _resolve_client_key(request)

    blocked_until = _blocked_until_by_client.get(client_key)
    if blocked_until is not None and blocked_until > now:
        retry_after = max(1, int((blocked_until - now).total_seconds()))
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again shortly.",
            headers={"Retry-After": str(retry_after)},
        )

    minute_window = _minute_window_by_client[client_key]
    hour_window = _hour_window_by_client[client_key]

    _prune_window(minute_window, now - timedelta(minutes=1))
    _prune_window(hour_window, now - timedelta(hours=1))

    if len(minute_window) >= RATE_LIMIT_PER_MINUTE or len(hour_window) >= RATE_LIMIT_PER_HOUR:
        blocked = now + timedelta(seconds=RATE_LIMIT_BLOCK_SECONDS)
        _blocked_until_by_client[client_key] = blocked
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again shortly.",
            headers={"Retry-After": str(RATE_LIMIT_BLOCK_SECONDS)},
        )

    previous_seen = _session_last_seen_by_id.get(session_id)
    if previous_seen is not None:
        idle_seconds = (now - previous_seen).total_seconds()
        if idle_seconds > SESSION_IDLE_TIMEOUT_SECONDS:
            _session_last_seen_by_id.pop(session_id, None)
            raise HTTPException(
                status_code=440,
                detail="Session expired due to inactivity. Start a new conversation.",
            )

    minute_window.append(now)
    hour_window.append(now)
    _session_last_seen_by_id[session_id] = now


def _apply_gateway_location(state: Dict[str, Any], request: Request) -> Dict[str, Any]:
    normalized_state = dict(state)
    gateway_location = _normalize_location_value(request.headers.get("X-Pixie-Location"))
    if gateway_location is not None:
        normalized_state["location"] = gateway_location
    return normalized_state


@app.on_event("startup")
async def startup_check() -> None:
    global _http_client
    _http_client = httpx.AsyncClient(base_url=BACKEND_BASE_URL, timeout=30.0)
    await refresh_backend_health(force=True)


@app.on_event("shutdown")
async def shutdown_client() -> None:
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None


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

    session_id: str | None = Field(default=None, max_length=128)
    current_answer: str | None = Field(default=None, max_length=MAX_CHAT_INPUT_CHARS)
    state: Dict[str, Any] | None = None
    user_input: str | None = None
    conversation_id: str | None = Field(default=None, max_length=128)
    history: List[str] | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        normalized = dict(value)
        if "user_input" not in normalized and "input" in normalized:
            normalized["user_input"] = normalized.get("input")
        if "conversation_id" not in normalized and "conversationId" in normalized:
            normalized["conversation_id"] = normalized.get("conversationId")
        return normalized


async def call_qa_backend(
    current_answer: str,
    session_id: str,
    state: Dict[str, Any],
    history: List[str] | None,
) -> tuple[Dict[str, Any], str | None]:
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
            status_code=502, detail=f"Invalid JSON received from Pixie {PIXIE_BACKEND_TARGET}"
        ) from exc

    if not isinstance(data, dict):
        raise HTTPException(
            status_code=502, detail=f"Unexpected response format from Pixie {PIXIE_BACKEND_TARGET}"
        )

    contract_version: str | None = None
    if PIXIE_BACKEND_TARGET == "questioner":
        contract_version = response.headers.get("X-Pixie-Chat-Contract")
        if not contract_version:
            detail = (
                "Missing X-Pixie-Chat-Contract header from Pixie Questioner response."
            )
            if STRICT_QUESTIONER_CHAT_CONTRACT:
                raise HTTPException(status_code=502, detail=detail)
            logger.warning(detail)
        elif contract_version != PIXIE_CHAT_CONTRACT_VERSION:
            detail = (
                "Unsupported Pixie Questioner chat contract version "
                f"'{contract_version}', expected '{PIXIE_CHAT_CONTRACT_VERSION}'."
            )
            if STRICT_QUESTIONER_CHAT_CONTRACT:
                raise HTTPException(status_code=502, detail=detail)
            logger.warning(detail)

    return data, contract_version


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
    state = _normalize_state_location(state, strict=False)

    response: Dict[str, Any] = {
        "type": response_type or "answer",
        "text": text,
        "conversation_id": data.get("conversation_id")
        or data.get("conversationId")
        or session_id,
        "state": state,
    }
    summary_text = _extract_summary_text(data)
    if summary_text:
        response["summary"] = summary_text
    follow_up_question = _extract_follow_up_question(data)
    if follow_up_question:
        response["follow_up_question"] = follow_up_question
    quick_replies = _normalize_quick_replies(data, state)
    if response["type"] == "answer" and quick_replies:
        response["quick_replies"] = quick_replies
    return response


@app.post("/chat")
async def chat(payload: ChatRequest, response: Response, request: Request) -> Dict[str, Any]:
    """Forward chat request to the configured Pixie backend for the active client."""
    current_answer = (payload.current_answer or payload.user_input or "").strip()
    if not current_answer:
        raise HTTPException(status_code=400, detail="Input may not be empty.")

    has_session = bool(payload.session_id or payload.conversation_id)
    session_id = payload.session_id or payload.conversation_id or str(uuid4())
    request_state = payload.state if isinstance(payload.state, dict) else {}
    request_state = _apply_gateway_location(request_state, request)
    sanitized_history = _enforce_payload_limits(current_answer, request_state, payload.history)
    _enforce_abuse_limits(request, session_id)

    await ensure_backend_ready()

    if PIXIE_BACKEND_TARGET in {"informer", "questioner"}:
        state = _normalize_state_location(request_state, strict=True)
        qa_response = await call_qa_backend(
            current_answer=current_answer,
            session_id=session_id,
            state=state,
            history=sanitized_history,
        )
        qa_data, contract_version = qa_response
        if PIXIE_BACKEND_TARGET == "questioner" and contract_version is not None:
            response.headers["X-Pixie-Chat-Contract"] = contract_version
        return _normalize_chat_response(qa_data, session_id, state)

    state = _normalize_state_location(request_state, strict=True)
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
