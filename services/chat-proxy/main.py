import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Determine target backend (recommender or informer)
PIXIE_TARGET_BACKEND = os.environ.get("PIXIE_TARGET_BACKEND", "recommender").strip().lower()
if PIXIE_TARGET_BACKEND not in {"recommender", "informer"}:
    raise RuntimeError("PIXIE_TARGET_BACKEND must be either 'recommender' or 'informer'")

# Validate required environment variables per backend
PIXIE_CORE_API_BASE_URL = None
PIXIE_INFORMER_API_BASE_URL = None

if PIXIE_TARGET_BACKEND == "recommender":
    _pixie_url = os.environ.get("PIXIE_CORE_API_BASE_URL") or os.environ.get("PIXIE_API_BASE_URL")
    if not _pixie_url:
        raise RuntimeError("PIXIE_CORE_API_BASE_URL environment variable is required")
    PIXIE_CORE_API_BASE_URL = _pixie_url.rstrip("/")
else:
    _pixie_informer_url = os.environ.get("PIXIE_INFORMER_API_BASE_URL")
    if not _pixie_informer_url:
        raise RuntimeError("PIXIE_INFORMER_API_BASE_URL environment variable is required when PIXIE_TARGET_BACKEND='informer'")
    PIXIE_INFORMER_API_BASE_URL = _pixie_informer_url.rstrip("/")

_client_id = os.environ.get("ACTIVE_CLIENT_ID")
if not _client_id:
    raise RuntimeError("ACTIVE_CLIENT_ID environment variable is required")
ACTIVE_CLIENT_ID: str = _client_id

PIXIE_API_KEY = os.environ.get("PIXIE_API_KEY")
BACKEND_BASE_URL: str = (
    PIXIE_CORE_API_BASE_URL if PIXIE_TARGET_BACKEND == "recommender" else PIXIE_INFORMER_API_BASE_URL  # type: ignore[arg-type]
)

HEALTH_PATH = "/health"
HEALTH_CACHE_SECONDS = 15

BackendHealth = Dict[str, Optional[Any]]
_backend_health: BackendHealth = {
    "status": "unknown",
    "detail": None,
    "checked_at": None,
}


def build_client_payload() -> Dict[str, Any]:
    """Build client configuration from environment variables."""
    theme: Dict[str, str] = {}

    # Add theme properties if defined
    if primary_color := os.environ.get("ACTIVE_CLIENT_PRIMARY_COLOR"):
        theme["primaryColor"] = primary_color
    if logo_url := os.environ.get("ACTIVE_CLIENT_LOGO_URL"):
        theme["logoUrl"] = logo_url
    if bg_image := os.environ.get("ACTIVE_CLIENT_BACKGROUND_IMAGE_URL"):
        theme["backgroundImageUrl"] = bg_image

    return {
        "id": ACTIVE_CLIENT_ID,
        "displayName": os.environ.get("ACTIVE_CLIENT_DISPLAY_NAME", ACTIVE_CLIENT_ID),
        "theme": theme,
        "welcomeMessage": os.environ.get("ACTIVE_CLIENT_WELCOME_MESSAGE"),
    }


@app.get("/client")
async def client() -> Dict[str, Any]:
    """Expose active client branding and identifiers to the UI."""
    return build_client_payload()


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def refresh_backend_health(force: bool = False) -> BackendHealth:
    """Check backend /health endpoint and cache the result briefly."""
    global _backend_health
    if (
        not force
        and _backend_health["checked_at"]
        and (_now() - _backend_health["checked_at"]) < timedelta(seconds=HEALTH_CACHE_SECONDS)  # type: ignore[operator]
    ):
        return _backend_health

    url = f"{BACKEND_BASE_URL}{HEALTH_PATH}"

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(url)
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
    await refresh_backend_health(force=True)


@app.get("/health")
async def health() -> Dict[str, Any]:
    state = await refresh_backend_health()
    return {
        "status": state["status"],
        "targetBackend": PIXIE_TARGET_BACKEND,
        "backendUrl": BACKEND_BASE_URL,
        "detail": state["detail"],
        "checkedAt": state["checked_at"].isoformat() if state["checked_at"] else None,
    }


async def call_pixie(payload: Dict[str, Any]) -> Dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    if PIXIE_API_KEY:
        headers["Authorization"] = f"Bearer {PIXIE_API_KEY}"

    async with httpx.AsyncClient(
        base_url=PIXIE_CORE_API_BASE_URL, timeout=30.0
    ) as client:
        try:
            response = await client.post("/ask", json=payload, headers=headers)
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

    user_input: str = Field(..., alias="input")
    conversation_id: str | None = Field(default=None, alias="conversationId")
    history: List[str] | None = None


async def call_informer(question: str, session_id: str, history: List[str] | None) -> Dict[str, Any]:
    """Forward chat request to Pixie Informer `/ask` endpoint."""
    payload = {
        "question": question,
        "session_id": session_id,
        "history": history or [],
    }

    async with httpx.AsyncClient(
        base_url=PIXIE_INFORMER_API_BASE_URL, timeout=30.0
    ) as client:
        try:
            response = await client.post("/ask", json=payload)
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
                status_code=502, detail=f"Error reaching Pixie Informer: {exc}"
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


@app.post("/chat")
async def chat(payload: ChatRequest) -> Dict[str, Any]:
    """Forward chat request to the configured Pixie backend for the active client."""
    user_input = payload.user_input.strip()
    if not user_input:
        raise HTTPException(status_code=400, detail="Input may not be empty.")

    await ensure_backend_ready()

    if PIXIE_TARGET_BACKEND == "informer":
        session_id = payload.conversation_id or str(uuid4())
        informer_response = await call_informer(
            question=user_input,
            session_id=session_id,
            history=payload.history,
        )
        return {
            "type": "answer",
            "text": informer_response.get("answer"),
            "conversationId": session_id,
        }

    if payload.conversation_id:
        pixie_payload = {"conversation_id": payload.conversation_id, "message": user_input}
    else:
        pixie_payload = {"question": user_input}

    pixie_response = await call_pixie(pixie_payload)

    return {
        "type": pixie_response.get("type"),
        "text": pixie_response.get("text"),
        "prompt": pixie_response.get("prompt"),
        "reason": pixie_response.get("reason"),
        "conversationId": pixie_response.get("conversation_id"),
    }
