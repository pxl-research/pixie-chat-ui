# Chat Proxy

Minimal containerized chat experience that forwards requests through a Pixie Core proxy. The project ships two services—`api-proxy` (FastAPI) and `ui` (Vite + React)—wired together with Docker Compose for quick local bootstrap and customer specific theming.

## Getting Started

1. Install Docker and Docker Compose.
2. Copy the sample environment into place:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` with your Pixie Core credentials and set `ACTIVE_CLIENT_ID` to the customer you want to enable.
4. Build and run the stack:
   ```bash
   docker compose up --build
   ```
5. Visit `http://localhost:3000` to access the chat UI. The API proxy is exposed at `http://localhost:8000`.

## Repository Structure

```
configs/               # Shared client definitions mounted into each service
infra/                 # Infrastructure helpers (e.g., Makefile)
services/api-proxy/    # FastAPI proxy service that talks to Pixie Core
services/ui/           # React UI served via Vite
docker-compose.yml     # Service orchestration
```

## Customer Configuration

Customer metadata lives in `configs/clients.json`. Each entry specifies:

- `id`: unique identifier referenced by `ACTIVE_CLIENT_ID`
- `displayName`: label displayed in the UI
- `collectionId`: Pixie collection forwarded with chat requests
- `theme`: optional styling hooks such as `primaryColor` and `logoUrl`

To add a new customer:

1. Append a new JSON object to `configs/clients.json`.
2. Drop any branding assets under `services/ui/public/branding/`.
3. Update your `.env` (or Compose overrides) with the new `ACTIVE_CLIENT_ID`.
4. Restart the stack (`docker compose up --build`) to apply the change.

## Active Client Resolution

Both the UI and the proxy read `configs/clients.json` during startup, filter for the client whose `id` matches `ACTIVE_CLIENT_ID`, and expose that configuration at runtime. Switching customers is a deployment-time decision—update the environment variable and restart the containers to target a different client.

## Validation Checklist

- `docker compose up --build` completes without errors.
- UI is reachable at `http://localhost:3000`.
- Theme reflects the customer specified by `ACTIVE_CLIENT_ID`.
- `/chat` endpoint proxies requests to Pixie Core (replace with a mock if needed).
- Headless request example:
  ```bash
  curl -X POST http://localhost:8000/chat \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"Hello!"}]}'
  ```

## Adding Customers for Different Deployments

Repeat the customer configuration steps for every new deployment. Keep `ACTIVE_CLIENT_ID` aligned with your target client, and document the choice alongside your deployment notes to ensure reproducible launches.
