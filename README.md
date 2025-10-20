# Chat Proxy

Minimal containerized chat experience that forwards requests through a Pixie Core proxy. The project ships two services—`chat-proxy` (FastAPI) and `chat-ui` (Vite + React)—wired together with Docker Compose for quick local bootstrap and customer specific theming.

## Getting Started

1. Install Docker and Docker Compose.
2. Copy the sample environment into place:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` with your Pixie Core API base URL (see [Pixie Core connectivity](#pixie-core-connectivity)) and set `ACTIVE_CLIENT_ID` to the customer you want to enable.
4. Build and run the stack:
   ```bash
   docker compose up --build
   ```
5. Visit `http://localhost:3000` to access the chat UI. The API proxy is exposed at `http://localhost:8010`.

## Repository Structure

```
configs/               # (Optional) curated client definitions to seed deployments
infra/                 # Infrastructure helpers (e.g., Makefile)
services/chat-proxy/   # FastAPI proxy service that talks to Pixie Core
services/chat-ui/      # React chat UI served via Vite
docker-compose.yml     # Service orchestration
```

## Customer Configuration

The proxy derives the active client's configuration entirely from environment variables. Set the following values in `.env` (or your deployment secrets):

- `ACTIVE_CLIENT_ID` (required) – unique identifier for the deployment.
- `ACTIVE_CLIENT_DISPLAY_NAME` (optional) – label shown in the UI, defaults to the client ID.
- `ACTIVE_CLIENT_COLLECTION_ID` (optional) – available if downstream services need to branch on collection.
- `ACTIVE_CLIENT_WELCOME_MESSAGE` (optional) – greeting rendered in the chat window.
- `ACTIVE_CLIENT_PRIMARY_COLOR`, `ACTIVE_CLIENT_LOGO_URL`, `ACTIVE_CLIENT_BACKGROUND_IMAGE_URL` (optional) – branding hooks exposed to the UI.

The UI fetches the configuration from the `/client` endpoint, which builds the response directly from these environment variables.

## Per-deployment Branding Overrides

All overrides are environment-driven. Update the optional variables listed above and redeploy; the proxy reads the environment variables on startup and the UI reflects the new branding after a refresh.

## UI Connectivity

- `VITE_API_BASE_URL` is still accepted at build time, but the UI now prefers runtime configuration sourced from `/env-config.js` (materialised inside the container before the preview server starts). Set `VITE_API_BASE_URL` in `.env` so the injection script can mirror it; the page then reads `window.__ENV.API_BASE_URL` and talks to the proxy without rebuilding the image.
- Running the UI outside Docker? Execute `node scripts/inject-runtime-config.mjs` after `npm run build` (or just before `npm run preview`) to write `dist/env-config.js` based on the current environment.
- If neither runtime nor build-time values are present, the bundle falls back to `window.location.origin`, which keeps co-hosted deployments working.

## Pixie Core Connectivity

- `PIXIE_CORE_API_BASE_URL` tells the proxy where to reach the Pixie Core `/ask` endpoint.
  - When the stack runs inside Docker alongside Pixie Core, point it to `http://api:8000` and attach both services to the shared `pixie-network`.
  - When you test from the host while Pixie Core is exposed on the host, point it to the mapped port (e.g. `http://localhost:8012`).
- If your Pixie Core environment enforces authentication, add `PIXIE_API_KEY` to `.env`; the proxy forwards it as a `Bearer` token.
- Create the external Docker network up-front if it does not exist yet:
  ```bash
  docker network create pixie-network
  ```
- The proxy forwards user input as `question` (new flow) or `message` (follow-up replies) and keeps track of `conversation_id` values returned by Pixie Core. The UI shows follow-up prompts whenever Pixie Core answers with `type: "ask_user"`.

## Validation Checklist

- `docker compose up --build` completes without errors.
- UI is reachable at `http://localhost:3000`.
- Theme reflects the customer specified by `ACTIVE_CLIENT_ID`.
- `/chat` endpoint proxies requests to Pixie Core. Use `PIXIE_CORE_API_BASE_URL=http://localhost:8012` if you interact from the host against a locally exposed Pixie Core stack.
- Headless request example:
  ```bash
  curl -X POST http://localhost:8010/chat \
    -H "Content-Type: application/json" \
    -d '{"input":"Hallo Pixie, welke bureaustoelen raadt je aan?"}'
  ```

## Adding Customers for Different Deployments

Repeat the customer configuration steps for every new deployment. Keep `ACTIVE_CLIENT_ID` aligned with your target client, and document the choice alongside your deployment notes to ensure reproducible launches.
