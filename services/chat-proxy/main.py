from typing import Any, Dict

import json
import os
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from bootstrap import collect_theme_overrides, build_client_definition, ensure_client_config_file

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PIXIE_CORE_API_BASE_URL = os.environ.get("PIXIE_CORE_API_BASE_URL") or os.environ.get("PIXIE_API_BASE_URL")
if not PIXIE_CORE_API_BASE_URL:
    raise RuntimeError("PIXIE_CORE_API_BASE_URL environment variable is required")

CLIENT_CONFIG_PATH = str(ensure_client_config_file())
ACTIVE_CLIENT_ID = os.environ["ACTIVE_CLIENT_ID"]
PIXIE_API_KEY = os.environ.get("PIXIE_API_KEY")

PIXIE_CORE_API_BASE_URL = PIXIE_CORE_API_BASE_URL.rstrip("/")


def load_client_config() -> Dict[str, Any]:
    path = Path(CLIENT_CONFIG_PATH)
    try:
        with path.open("r", encoding="utf-8") as handle:
            clients = json.load(handle)
    except FileNotFoundError:
        return build_client_definition()
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON in {path}: {exc}") from exc

    if not isinstance(clients, list):
        raise RuntimeError(f"Client config at {path} must be a list of clients")

    matched = next((c for c in clients if c["id"] == ACTIVE_CLIENT_ID), None)
    if matched is None:
        return build_client_definition()
    return matched


CLIENT = load_client_config()


def build_client_payload() -> Dict[str, Any]:
    theme = dict(CLIENT.get("theme", {}))
    theme.update(collect_theme_overrides())

    welcome_message = os.environ.get("ACTIVE_CLIENT_WELCOME_MESSAGE") or CLIENT.get("welcomeMessage")
    display_name = os.environ.get("ACTIVE_CLIENT_DISPLAY_NAME") or CLIENT.get("displayName") or CLIENT["id"]

    return {
        "id": CLIENT["id"],
        "displayName": display_name,
        "theme": theme,
        "welcomeMessage": welcome_message,
    }


@app.get("/client")
async def client() -> Dict[str, Any]:
    """Expose active client branding and identifiers to the UI."""
    return build_client_payload()


async def call_pixie(payload: Dict[str, Any]) -> Dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    if PIXIE_API_KEY:
        headers["Authorization"] = f"Bearer {PIXIE_API_KEY}"

    async with httpx.AsyncClient(base_url=PIXIE_CORE_API_BASE_URL, timeout=30.0) as client:
        try:
            response = await client.post("/ask", json=payload, headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            try:
                detail = exc.response.json()
            except ValueError:
                detail = exc.response.text
            raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Error reaching Pixie Core: {exc}") from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Invalid JSON received from Pixie Core") from exc

    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Unexpected response format from Pixie Core")

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
