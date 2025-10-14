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
configs/               # Shared client definitions mounted into each service
infra/                 # Infrastructure helpers (e.g., Makefile)
services/chat-proxy/   # FastAPI proxy service that talks to Pixie Core
services/chat-ui/      # React chat UI served via Vite
docker-compose.yml     # Service orchestration
```

## Customer Configuration

Customer metadata lives in `configs/clients.json`. Each entry specifies:

- `id`: unique identifier referenced by `ACTIVE_CLIENT_ID`
- `displayName`: label displayed in the UI
- `collectionId`: Pixie collection identifier (available to the proxy if you need to branch behaviour per client)
- `theme`: optional styling hooks such as `primaryColor`, `logoUrl`, and `backgroundImageUrl`
- `welcomeMessage`: opt-in greeting shown in the chat window before the user types

To add a new customer:

1. Append a new JSON object to `configs/clients.json`.
2. Drop any branding assets under `services/chat-ui/public/branding/`.
3. Update your `.env` (or Compose overrides) with the new `ACTIVE_CLIENT_ID`.
4. Restart the stack (`docker compose up --build`) to apply the change.

## Active Client Resolution

Both the UI and the proxy read `configs/clients.json` during startup, filter for the client whose `id` matches `ACTIVE_CLIENT_ID`, and expose that configuration at runtime. Switching customers is a deployment-time decision—update the environment variable and restart the containers to target a different client.

## Per-deployment Branding Overrides

When you only need to adjust the active client's branding for a specific deployment, set any of these optional values in `.env` instead of editing `configs/clients.json`:

- `ACTIVE_CLIENT_WELCOME_MESSAGE`
- `ACTIVE_CLIENT_PRIMARY_COLOR`
- `ACTIVE_CLIENT_LOGO_URL`
- `ACTIVE_CLIENT_BACKGROUND_IMAGE_URL`

The proxy merges these overrides into the client configuration it serves to the UI, so changes take effect after redeploying the stack.

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
