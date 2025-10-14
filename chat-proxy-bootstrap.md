# Minimal Chat Proxy Project Bootstrap

Use this specification to scaffold a brand-new repository that hosts a minimal, containerized chat experience talking to the Pixie Core API. The scope is deliberately small: get a customer-configurable (deployment-time) chat UI running locally via Docker, with an API proxy that forwards traffic to Pixie.

---

## 1. Repository Kick-off

1. Initialize an empty git repository.
2. Add a `README.md` that repeats the high-level purpose, setup commands, and explains how to add customers.
3. Commit after the skeleton is in place.

```
chat-proxy/
├── configs/
├── infra/
├── services/
│   ├── api-proxy/
│   └── ui/
└── docker-compose.yml
```

---

## 2. Shared Configuration

### 2.1 `.env.example`

```
PIXIE_API_BASE_URL=https://pixie-core.example/api
PIXIE_API_KEY=replace-me
ACTIVE_CLIENT_ID=auva
DEFAULT_CHAT_MODEL=gpt-4o-mini
```

Copy to `.env` for local runs.

### 2.2 `configs/clients.json`

```json
[
  {
    "id": "auva",
    "displayName": "AUVA",
    "collectionId": "collection-auva",
    "theme": {
      "primaryColor": "#0055A4",
      "logoUrl": "/branding/auva-logo.png"
    }
  },
  {
    "id": "wara",
    "displayName": "WARA",
    "collectionId": "collection-wara",
    "theme": {
      "primaryColor": "#C23C2A",
      "logoUrl": "/branding/wara-logo.png"
    }
  }
]
```

Mount this file read-only into each container. Add a short `README` section about extending this list.

### 2.3 Active client resolution

- Set `ACTIVE_CLIENT_ID` in `.env` (or compose overrides) to point at the customer you want this deployment to use.
- Both the UI and the proxy read `configs/clients.json`, pick the entry whose `id` matches `ACTIVE_CLIENT_ID`, and never expose runtime switching to end users.
- Changing the customer means updating the env var and restarting the stack; document this explicitly.

---

## 3. API Proxy Service (`services/api-proxy`)

Target: Python 3.11 + FastAPI (minimal dependency surface, async support).

### 3.1 `pyproject.toml`

```toml
[project]
name = "chat-proxy-api"
version = "0.1.0"
dependencies = ["fastapi", "uvicorn[standard]", "httpx"]

[build-system]
requires = ["setuptools", "wheel"]
build-backend = "setuptools.build_meta"
```

### 3.2 `main.py`

```python
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
```

### 3.3 `Dockerfile`

```
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml /app/
RUN pip install --no-cache-dir fastapi uvicorn[standard] httpx
COPY . /app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 4. UI Service (`services/ui`)

Target: Vite + React (fast cold-start, simple).

### 4.1 Bootstrap

1. `npm create vite@latest ui -- --template react-ts`
2. Move generated files into `services/ui`.
3. Install dependencies: `npm install`.

### 4.2 Key components

- `src/config/client.ts`: fetches `/client` from the proxy to retrieve branding/meta for the active customer.
- `src/hooks/useChat.ts`: wraps calls to `/api/chat`.
- `src/components/ChatWindow.tsx`: renders message list + input and styles with the active client's theme.
- `src/components/Header.tsx`: shows logo/name pulled from the active client's branding.

### 4.3 Proxy Settings

Set `VITE_API_BASE_URL=http://api-proxy:8000` in `.env.development` (or inject via Docker). The UI loads the active client by calling the proxy's `/client` endpoint.

### 4.4 `Dockerfile`

```
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile
COPY . .
RUN npm run build
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
```

---

## 5. Docker Compose (`docker-compose.yml`)

```yaml
version: "3.9"
services:
  api-proxy:
    build:
      context: ./services/api-proxy
    env_file: .env
    environment:
      CLIENT_CONFIG_PATH: /app/configs/clients.json
    volumes:
      - ./configs:/app/configs:ro
    ports:
      - "8000:8000"

  ui:
    build:
      context: ./services/ui
    environment:
      VITE_API_BASE_URL: http://api-proxy:8000
    volumes:
      - ./configs:/app/configs:ro
    depends_on:
      - api-proxy
    ports:
      - "3000:3000"
```

Add a `make up` convenience target under `infra/Makefile` that runs `docker compose up --build`.

---

## 6. Branding Assets

- Store per-client assets in `services/ui/public/branding/`.
- Use the `logoUrl` values in UI components.
- Explain in README how to add new assets and update `clients.json`.

---

## 7. Validation Checklist

1. `docker compose up --build` boots without errors.
2. UI loads at `http://localhost:3000`.
3. UI reflects the theme for the active client set via `ACTIVE_CLIENT_ID`.
4. Sending a message calls `/chat` and proxies to Pixie (replace with mock when Pixie API unavailable).
5. `curl -X POST http://localhost:8000/chat ...` works headlessly (document sample payload).

---

## 8. Deliverables Summary

- Repository with skeleton structure, Docker setup, minimal FastAPI proxy, Vite-based chat UI.
- `README.md` covering prerequisites, configuration, run instructions, customer onboarding.
- `.env.example` and `configs/clients.json` to copy/fill.
- Instructions for swapping in different frontends or avatars later.

This is intentionally lean—focus on reliable local container orchestration and a simple, verifiable chat loop.
