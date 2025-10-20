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
│   ├── chat-proxy/
│   └── chat-ui/
└── docker-compose.yml
```

---

## 2. Shared Configuration

### 2.1 `.env.example`

```
PIXIE_CORE_API_BASE_URL=https://pixie-core.example/api
# PIXIE_API_KEY=replace-me
ACTIVE_CLIENT_ID=auva
ACTIVE_CLIENT_DISPLAY_NAME=AUVA
# ACTIVE_CLIENT_WELCOME_MESSAGE=
# ACTIVE_CLIENT_PRIMARY_COLOR=
# ACTIVE_CLIENT_LOGO_URL=
# ACTIVE_CLIENT_BACKGROUND_IMAGE_URL=
# ACTIVE_CLIENT_COLLECTION_ID=
VITE_API_BASE_URL=http://localhost:8010
```

Copy to `.env` for local runs.

### 2.2 Client config bootstrap

- Default the proxy to write `/app/configs/clients.json` on startup by deriving the active client's definition from the environment variables above.
- The generated file only needs to contain the active client. Keep the structure compatible with future expansions (`id`, `displayName`, optional `collectionId`, `theme`, `welcomeMessage`) so that downstream services can still consume it.
- Allow deployments to provide their own JSON file by supplying `CLIENT_CONFIG_PATH` (the bootstrapper should skip regeneration when the file already exists).
- Document in the `README` that the JSON file is optional—only required when you want to ship multiple client definitions or maintain them outside of environment variables.

### 2.3 Active client resolution

- Set `ACTIVE_CLIENT_ID` (and optional display/branding env vars) in `.env` or Compose overrides.
- On container startup the bootstrapper ensures the client config file exists, generating one from the environment when absent.
- The proxy loads the active client data once and merges the runtime overrides on every `/client` request.
- Switching to a different client is still a deployment-time decision: update the env vars and restart the stack.

---

## 3. API Proxy Service (`services/chat-proxy`)

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
from typing import Any, Dict

import json
import os
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException

from bootstrap import build_client_definition, ensure_client_config_file

app = FastAPI()

PIXIE_CORE_API_BASE_URL = (os.environ.get("PIXIE_CORE_API_BASE_URL") or os.environ.get("PIXIE_API_BASE_URL", "")).rstrip("/")
if not PIXIE_CORE_API_BASE_URL:
    raise RuntimeError("PIXIE_CORE_API_BASE_URL environment variable is required")

CLIENT_CONFIG_PATH = str(ensure_client_config_file())
ACTIVE_CLIENT_ID = os.environ["ACTIVE_CLIENT_ID"]
PIXIE_API_KEY = os.environ.get("PIXIE_API_KEY")


def load_client_config() -> Dict[str, Any]:
    path = Path(CLIENT_CONFIG_PATH)
    try:
        with path.open("r", encoding="utf-8") as handle:
            clients = json.load(handle)
    except FileNotFoundError:
        return build_client_definition()

    matched = next((c for c in clients if c.get("id") == ACTIVE_CLIENT_ID), None)
    return matched or build_client_definition()


CLIENT = load_client_config()


@app.get("/client")
async def client() -> Dict[str, Any]:
    theme = dict(CLIENT.get("theme", {}))
    if os.environ.get("ACTIVE_CLIENT_PRIMARY_COLOR"):
        theme["primaryColor"] = os.environ["ACTIVE_CLIENT_PRIMARY_COLOR"]
    if os.environ.get("ACTIVE_CLIENT_LOGO_URL"):
        theme["logoUrl"] = os.environ["ACTIVE_CLIENT_LOGO_URL"]
    if os.environ.get("ACTIVE_CLIENT_BACKGROUND_IMAGE_URL"):
        theme["backgroundImageUrl"] = os.environ["ACTIVE_CLIENT_BACKGROUND_IMAGE_URL"]

    return {
        "id": CLIENT["id"],
        "displayName": os.environ.get("ACTIVE_CLIENT_DISPLAY_NAME", CLIENT.get("displayName", CLIENT["id"])),
        "theme": theme,
        "welcomeMessage": os.environ.get("ACTIVE_CLIENT_WELCOME_MESSAGE") or CLIENT.get("welcomeMessage"),
    }


async def call_pixie(payload: Dict[str, Any]) -> Dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    if PIXIE_API_KEY:
        headers["Authorization"] = f"Bearer {PIXIE_API_KEY}"

    async with httpx.AsyncClient(base_url=PIXIE_CORE_API_BASE_URL, timeout=30.0) as client:
        response = await client.post("/ask", json=payload, headers=headers)
        response.raise_for_status()
        return response.json()


@app.post("/chat")
async def chat(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Forward chat request to Pixie Core for the active client."""
    message = payload.get("input", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Input may not be empty.")

    pixie_payload = {"question": message}
    if payload.get("conversationId"):
        pixie_payload = {
            "conversation_id": payload["conversationId"],
            "message": message,
        }

    data = await call_pixie(pixie_payload)
    return {
        "type": data.get("type"),
        "text": data.get("text"),
        "prompt": data.get("prompt"),
        "reason": data.get("reason"),
        "conversationId": data.get("conversation_id"),
    }
```

### 3.3 `Dockerfile`

```
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml /app/
RUN pip install --no-cache-dir fastapi uvicorn[standard] httpx
COPY . /app
CMD ["python", "bootstrap.py"]
```

---

## 4. UI Service (`services/chat-ui`)

Target: Vite + React (fast cold-start, simple).

### 4.1 Bootstrap

1. `npm create vite@latest chat-ui -- --template react-ts`
2. Move generated files into `services/chat-ui`.
3. Install dependencies: `npm install`.

### 4.2 Key components

- `src/config/client.ts`: fetches `/client` from the proxy to retrieve branding/meta for the active customer.
- `src/hooks/useChat.ts`: wraps calls to `/api/chat`.
- `src/components/ChatWindow.tsx`: renders message list + input and styles with the active client's theme.
- `src/components/Header.tsx`: shows logo/name pulled from the active client's branding.

### 4.3 Proxy Settings

- Keep `VITE_API_BASE_URL` in the environment; the UI copies it into a runtime script (`/env-config.js`) right before the preview server starts so you can swap proxy endpoints without rebuilding the image.
- If you launch the UI outside of Docker, run `node scripts/inject-runtime-config.mjs` after `npm run build` to regenerate `dist/env-config.js` with the current environment values.
- When no runtime value is present, the bundle falls back to the compile-time `VITE_API_BASE_URL` and finally `window.location.origin`, which keeps co-hosted deployments working.

### 4.4 `Dockerfile`

```
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile
COPY . .
RUN npm run build
CMD ["sh", "-c", "node scripts/inject-runtime-config.mjs && npm run preview -- --host 0.0.0.0 --port 3000"]
```

---

## 5. Docker Compose (`docker-compose.yml`)

```yaml
version: "3.9"
services:
  chat-proxy:
    build:
      context: ./services/chat-proxy
    env_file: .env
    ports:
      - "8010:8000"

  chat-ui:
    build:
      context: ./services/chat-ui
    env_file: .env
    depends_on:
      - chat-proxy
    ports:
      - "3000:3000"
```

Add a `make up` convenience target under `infra/Makefile` that runs `docker compose up --build`.

---

## 6. Branding Assets

- Store per-client assets in `services/chat-ui/public/branding/`.
- Use the `logoUrl` values in UI components.
- Explain in README how to add new assets and which environment variables (or optional JSON overrides) need to change.

---

## 7. Validation Checklist

1. `docker compose up --build` boots without errors.
2. UI loads at `http://localhost:3000`.
3. UI reflects the theme for the active client set via `ACTIVE_CLIENT_ID`.
4. Sending a message calls `/chat` and proxies to Pixie (replace with mock when Pixie API unavailable).
5. `curl -X POST http://localhost:8010/chat ...` works headlessly (document sample payload).

---

## 8. Deliverables Summary

- Repository with skeleton structure, Docker setup, minimal FastAPI proxy, Vite-based chat UI.
- `README.md` covering prerequisites, configuration, run instructions, customer onboarding.
- `.env.example` (plus optional sample `configs/clients.json` if you want to illustrate multi-client setups).
- Instructions for swapping in different frontends or avatars later.

This is intentionally lean—focus on reliable local container orchestration and a simple, verifiable chat loop.
