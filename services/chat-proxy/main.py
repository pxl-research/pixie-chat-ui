from typing import Any, Dict

import os

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

# Validate required environment variables
_pixie_url = os.environ.get("PIXIE_CORE_API_BASE_URL") or os.environ.get(
    "PIXIE_API_BASE_URL"
)
if not _pixie_url:
    raise RuntimeError("PIXIE_CORE_API_BASE_URL environment variable is required")
PIXIE_CORE_API_BASE_URL: str = _pixie_url.rstrip("/")

_client_id = os.environ.get("ACTIVE_CLIENT_ID")
if not _client_id:
    raise RuntimeError("ACTIVE_CLIENT_ID environment variable is required")
ACTIVE_CLIENT_ID: str = _client_id

PIXIE_API_KEY = os.environ.get("PIXIE_API_KEY")


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


@app.post("/chat")
async def chat(payload: ChatRequest) -> Dict[str, Any]:
    """Forward chat request to Pixie Core `/ask` endpoint for the active client."""
    user_input = payload.user_input.strip()
    if not user_input:
        raise HTTPException(status_code=400, detail="Input may not be empty.")

    if payload.conversation_id:
        pixie_payload = {
            "conversation_id": payload.conversation_id,
            "message": user_input,
        }
    else:
        pixie_payload = {
            "question": user_input,
        }

    pixie_response = await call_pixie(pixie_payload)

    return {
        "type": pixie_response.get("type"),
        "text": pixie_response.get("text"),
        "prompt": pixie_response.get("prompt"),
        "reason": pixie_response.get("reason"),
        "conversationId": pixie_response.get("conversation_id"),
    }
