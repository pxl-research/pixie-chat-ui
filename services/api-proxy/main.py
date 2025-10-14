from typing import Any, Dict, List

import json
import os

import httpx
from fastapi import FastAPI, HTTPException

app = FastAPI()

PIXIE_API_BASE_URL = os.environ["PIXIE_API_BASE_URL"]
PIXIE_API_KEY = os.environ["PIXIE_API_KEY"]
CLIENT_CONFIG_PATH = os.environ.get("CLIENT_CONFIG_PATH", "/app/configs/clients.json")
ACTIVE_CLIENT_ID = os.environ["ACTIVE_CLIENT_ID"]


def load_client_config() -> Dict[str, Any]:
    with open(CLIENT_CONFIG_PATH, "r", encoding="utf-8") as handle:
        clients = json.load(handle)
    matched = next((c for c in clients if c["id"] == ACTIVE_CLIENT_ID), None)
    if not matched:
        raise RuntimeError(f"Client '{ACTIVE_CLIENT_ID}' not found in {CLIENT_CONFIG_PATH}")
    return matched


CLIENT = load_client_config()


@app.get("/client")
async def client() -> Dict[str, Any]:
    """Expose active client branding and identifiers to the UI."""
    return {
        "id": CLIENT["id"],
        "displayName": CLIENT["displayName"],
        "theme": CLIENT.get("theme", {}),
    }


async def call_pixie(payload: Dict[str, Any]) -> Dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {PIXIE_API_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{PIXIE_API_BASE_URL}/chat", json=payload, headers=headers)
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()


@app.post("/chat")
async def chat(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Forward chat request to Pixie Core for the active client."""
    messages: List[Dict[str, Any]] = payload.get("messages", [])
    pixie_payload = {
        "collectionId": CLIENT["collectionId"],
        "model": payload.get("model", os.environ.get("DEFAULT_CHAT_MODEL")),
        "messages": messages,
    }
    return await call_pixie(pixie_payload)
