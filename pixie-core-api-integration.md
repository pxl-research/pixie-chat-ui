# Pixie Core API Integration Notes

Use this reference when wiring the `pixie-chat-ui` project to the running Pixie Core instance. It covers the network setup, base URLs, endpoints, payloads, and example flows expected by the `/ask` conversation API.

---

## 1. Where the API Runs

| Scenario | Base URL | Notes |
| --- | --- | --- |
| From the host machine | `http://localhost:8012` | `docker-compose.dev.yml` exposes container port `8000` on host port `8012`. |
| From another container on the same network | `http://api:8000` | The Pixie API service is named `api` in `docker-compose.dev.yml`. Containers must join the shared `pixie-network`. |

Network requirements:

```yaml
networks:
  pixie:
    external: true
    name: pixie-network

services:
  ui:
    networks:
      - pixie
```

- The Pixie Core stack already uses an external Docker network named `pixie-network`. Attach new services to this network so they can reach the API via the hostname `api`.
- If you only call the API from the host (e.g., during local development with Vite dev server), use `http://localhost:8012`.

Set an environment variable in the chat UI project, e.g. `PIXIE_CORE_API_BASE_URL`, and point it to the correct address for the current environment.

---

## 2. Available Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Returns `{"status": "ok"}` when the service is up. |
| `GET` | `/metrics` | Returns uptime metadata and the number of active conversations. |
| `POST` | `/ask` | Main conversation endpoint (new questions and follow-up replies). |

There is no authentication layer in the default dev stack. If you add one, document the required headers for the UI.

---

## 3. `/ask` Endpoint Contract

### 3.1 Request Body

```jsonc
// Start a new conversation
{
  "question": "Ik zoek een ergonomische bureaustoel met verstelbare armleuningen."
}

// Reply inside an existing conversation
{
  "conversation_id": "c7c31f8c-2f8f-4aa9-9ed7-6f0f3f7b02f6",
  "message": "Mag maximaal 350 euro kosten."
}
```

Fields:

- `question` (string, required for new conversations): User’s initial request.
- `conversation_id` (string, required for follow-up replies): Identifier returned by the API when it needs extra input.
- `message` (string, required for follow-up replies): User’s answer to the last question.

Do **not** send both `question` and `message` in the same payload. The API validates this and returns structured error responses when the payload is inconsistent.

### 3.2 Response Shape

All responses follow:

```json
{
  "type": "answer",
  "text": "string or null",
  "prompt": "string or null",
  "reason": "string or null",
  "conversation_id": "string or null"
}
```

`type` can be:

| Type | Meaning | Fields used |
| --- | --- | --- |
| `answer` | Terminal result with product summary | `text`, optional `conversation_id` (for logging only) |
| `no_results` | No matches found | `text` explains that nothing matched |
| `ask_user` | More info required | `prompt` contains the question to show; `conversation_id` must be stored for the next reply |
| `not_relevant` | User request is outside the dataset scope | Optional `text` clarifies |
| `error` | Unexpected or validation error | `reason` contains the issue string |

Additional details:
- `text` is formatted with newlines and bullet-like sections. Render as preformatted or convert to paragraphs.
- `prompt` is a plain sentence/question to display in the UI when further input is needed.
- `conversation_id` persists across `ask_user` responses and must be echoed back with the user’s follow-up message.

---

## 4. Example Flow

1. **Initial question**
   ```http
   POST /ask
   {
     "question": "Ik zoek een rode bureaustoel met lendensteun."
   }
   ```

   Possible response:
   ```json
   {
     "type": "ask_user",
     "prompt": "Welke prijsklasse heb je in gedachten voor de bureaustoel?",
     "conversation_id": "9b9a3d6e-210f-4f50-b0c9-8a011395c5d7"
   }
   ```

2. **Follow-up answer**
   ```http
   POST /ask
   {
     "conversation_id": "9b9a3d6e-210f-4f50-b0c9-8a011395c5d7",
     "message": "Maximaal 500 euro."
   }
   ```

   Final response:
   ```json
   {
     "type": "answer",
     "text": "Resultaten voor bureaustoelen:\n- model: ComfortPlus | prijs: 449 | kleur: rood\n- ...\nTotaal gevonden: 8",
     "conversation_id": "9b9a3d6e-210f-4f50-b0c9-8a011395c5d7"
   }
   ```

3. **Handling edge cases**
   - If the system cannot map the question to a known category, it returns `{"type": "error", "reason": "missing_category"}`.
   - If a user replies without supplying `message`, you get `{"type": "error", "reason": "'message' is required when replying"}`.
   - When the request is outside the dataset scope, you receive `{"type": "not_relevant", "text": "Not relevant"}`.

The UI should treat `answer` and `no_results` as the end of the flow (clear stored conversation id). Keep the id while receiving `ask_user`.

---

## 5. Checklist for the Chat UI Agent

1. Add a runtime config (env var or JSON) that sets `PIXIE_CORE_API_BASE_URL`.
2. Ensure the API client calls `POST {BASE_URL}/ask` with the payload shapes above.
3. Store `conversation_id` when the response type is `ask_user`; clear it when the flow ends.
4. Surface `prompt` questions verbatim to the user; send their answer via `message`.
5. Display `text` in responses, preserving newlines.
6. Optionally call `GET /health` during startup to verify connectivity.
7. When running inside Docker, attach the service to `pixie-network` (see section 1).

With this information the automation agent can finish the API wiring without guessing any defaults. Please keep this document in sync if endpoint contracts evolve.
