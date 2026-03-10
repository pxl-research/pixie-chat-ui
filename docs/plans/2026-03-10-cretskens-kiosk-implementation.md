# Cretskens Kiosk Chat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a new `services/chat-kiosk-ui` app for the Cretskens kiosk that talks directly to `pixie-questioner`, while keeping the existing VM-based `chat-ui + chat-proxy` flow unchanged.

**Architecture:** Keep the current VM product intact and add a second frontend app dedicated to kiosk use. Extract only the minimal shared Pixie chat primitives needed by both apps, then build the kiosk as a single-session React/Vite app with a small state machine (`start`, `chatting`, `completed`, `error`) and a light static runtime for Jetson.

**Tech Stack:** React 19, TypeScript, Vite/Vitest, Testing Library, shared TypeScript modules under `shared/`, multi-stage Docker build with a static web server, Node 20.19+ for local builds/tests.

---

**Execution notes**
- Use `@test-driven-development` for Tasks 1-5.
- Use `@verification-before-completion` before claiming the implementation is done.
- Stay in the worktree at `/Users/drphil/Documents/Werk/pixie-chat-ui/.worktrees/feat-cretskens-kiosk`.

### Task 1: Extract Shared Pixie Chat Primitives

**Files:**
- Create: `shared/pixie-chat/constants.ts`
- Create: `shared/pixie-chat/contract.ts`
- Create: `shared/pixie-chat/contractHeader.ts`
- Create: `shared/pixie-chat/responseParser.ts`
- Modify: `services/chat-ui/src/constants.ts`
- Modify: `services/chat-ui/src/api/contract.ts`
- Modify: `services/chat-ui/src/utils/responseParser.ts`
- Modify: `services/chat-ui/tsconfig.app.json`
- Modify: `services/chat-ui/vite.config.ts`
- Test: `services/chat-ui/src/api/chat.contract-version.test.ts`
- Test: `services/chat-ui/src/utils/responseParser.test.ts`

**Step 1: Write the failing tests**

Add one contract-header assertion and one parser assertion that must pass through the new shared module:

```ts
import { expect, it } from "vitest";
import { assertChatContractHeader } from "@pixie-chat/contractHeader";
import { parsePixieChatResponse } from "@pixie-chat/responseParser";

it("accepts chat-v2.0.0 contract headers", () => {
  expect(() =>
    assertChatContractHeader(new Headers({ "X-Pixie-Chat-Contract": "chat-v2.0.0" })),
  ).not.toThrow();
});

it("normalizes quick replies from payload and state", () => {
  const parsed = parsePixieChatResponse({
    type: "answer",
    text: "Kies een optie",
    quick_replies: ["Ja", { label: "Nee", value: "no" }],
    state: {},
  });

  expect(parsed.quickReplies).toEqual([
    { label: "Ja", value: "Ja" },
    { label: "Nee", value: "no" },
  ]);
});
```

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm run test:unit -- src/api/chat.contract-version.test.ts src/utils/responseParser.test.ts
```

Expected:
- FAIL with module resolution errors for `@pixie-chat/*` or missing exports.

**Step 3: Write the minimal shared implementation**

Create the shared files and make the existing app re-export from them:

```ts
// shared/pixie-chat/contractHeader.ts
import { CHAT_CONTRACT_VERSION } from "./contract";

export function assertChatContractHeader(headers: Headers): string | null {
  const contractHeader = headers.get("X-Pixie-Chat-Contract");
  if (contractHeader && contractHeader !== CHAT_CONTRACT_VERSION) {
    throw new Error(
      "The chat service is temporarily unavailable due to a version mismatch. Please refresh the page or try again later.",
    );
  }
  return contractHeader;
}
```

```ts
// services/chat-ui/src/api/contract.ts
export { CHAT_CONTRACT_VERSION } from "../../../shared/pixie-chat/contract";
export type {
  QuestionerChatContractRequest,
  QuestionerChatContractResponse,
} from "../../../shared/pixie-chat/contract";
```

```ts
// services/chat-ui/src/utils/responseParser.ts
export {
  parsePixieChatResponse as parseApiResponse,
} from "../../../shared/pixie-chat/responseParser";
```

Add a Vite alias so imports stay readable:

```ts
resolve: {
  alias: {
    "@pixie-chat": path.resolve(__dirname, "../../shared/pixie-chat"),
  },
},
server: {
  fs: {
    allow: [path.resolve(__dirname, "../..")],
  },
},
```

**Step 4: Run the tests to verify they pass**

Run:

```bash
npm run test:unit -- src/api/chat.contract-version.test.ts src/utils/responseParser.test.ts
```

Expected:
- PASS for the focused contract and parser tests.

**Step 5: Commit**

```bash
git add shared/pixie-chat services/chat-ui/src/constants.ts services/chat-ui/src/api/contract.ts services/chat-ui/src/utils/responseParser.ts services/chat-ui/tsconfig.app.json services/chat-ui/vite.config.ts services/chat-ui/src/api/chat.contract-version.test.ts services/chat-ui/src/utils/responseParser.test.ts
git commit -m "refactor: share pixie chat primitives"
```

### Task 2: Refit Existing Chat UI Through the Shared Contract Helpers

**Files:**
- Modify: `services/chat-ui/src/api/chat.ts`
- Modify: `services/chat-ui/src/hooks/useChat.ts`
- Test: `services/chat-ui/src/api/chat.contract-version.test.ts`
- Test: `services/chat-ui/src/hooks/useChat.test.ts`

**Step 1: Write the failing tests**

Extend the existing chat tests so the proxy wrapper proves it still uses the centralized contract handling:

```ts
it("keeps returning contract_version when the proxy forwards the questioner header", async () => {
  const result = await sendChatMessage({
    currentAnswer: "Hallo",
    sessionId: "session-1",
    state: {},
  });

  expect(result.contract_version).toBe("chat-v2.0.0");
});

it("still forwards debug_mode through the existing useChat hook", async () => {
  expect(mockedSendChatMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      state: expect.objectContaining({ debug_mode: true }),
    }),
  );
});
```

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm run test:unit -- src/api/chat.contract-version.test.ts src/hooks/useChat.test.ts
```

Expected:
- FAIL if `sendChatMessage` still owns header logic or breaks after the shared-module extraction.

**Step 3: Write the minimal implementation**

Move the proxy-specific fetch into a thin wrapper and reuse the shared helpers:

```ts
import { assertChatContractHeader } from "@pixie-chat/contractHeader";

export async function sendChatMessage(request: ChatApiRequest): Promise<ChatApiResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, { ... });

  if (!response.ok) {
    // keep existing proxy error handling
  }

  const contractVersion = assertChatContractHeader(response.headers);
  const parsed = (await response.json()) as ChatApiResponse;
  return contractVersion ? { ...parsed, contract_version: contractVersion } : parsed;
}
```

No behavioral change is expected in `useChat`; only adjust imports if the parser/function names moved.

**Step 4: Run the focused tests and the full existing unit suite**

Run:

```bash
npm run test:unit -- src/api/chat.contract-version.test.ts src/hooks/useChat.test.ts
npm run test:unit
```

Expected:
- PASS for the focused tests.
- PASS for the full `services/chat-ui` unit suite, proving use case 1 is unaffected.

**Step 5: Commit**

```bash
git add services/chat-ui/src/api/chat.ts services/chat-ui/src/hooks/useChat.ts services/chat-ui/src/api/chat.contract-version.test.ts services/chat-ui/src/hooks/useChat.test.ts
git commit -m "refactor: reuse shared pixie chat helpers in chat-ui"
```

### Task 3: Scaffold the New `chat-kiosk-ui` App

**Files:**
- Create: `services/chat-kiosk-ui/package.json`
- Create: `services/chat-kiosk-ui/tsconfig.json`
- Create: `services/chat-kiosk-ui/tsconfig.app.json`
- Create: `services/chat-kiosk-ui/tsconfig.node.json`
- Create: `services/chat-kiosk-ui/vite.config.ts`
- Create: `services/chat-kiosk-ui/index.html`
- Create: `services/chat-kiosk-ui/src/main.tsx`
- Create: `services/chat-kiosk-ui/src/App.tsx`
- Create: `services/chat-kiosk-ui/src/index.css`
- Create: `services/chat-kiosk-ui/src/env.d.ts`
- Create: `services/chat-kiosk-ui/src/test/setup.ts`
- Create: `services/chat-kiosk-ui/src/App.smoke.test.tsx`

**Step 1: Write the failing smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import App from "./App";

it("renders the kiosk start screen", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: "Start gesprek" })).toBeInTheDocument();
});
```

**Step 2: Run the test to verify it fails**

Run:

```bash
npm ci
npm run test:unit -- src/App.smoke.test.tsx
```

Expected:
- FAIL because the new app and scripts do not exist yet.

**Step 3: Create the minimal app shell**

Use the existing `services/chat-ui` toolchain as the baseline, but keep the app smaller:

```json
{
  "name": "chat-kiosk-ui",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test:unit": "vitest run"
  }
}
```

```tsx
// src/App.tsx
export default function App() {
  return (
    <main className="kiosk-shell">
      <section className="kiosk-start">
        <h1>Cretskens Assistent</h1>
        <button type="button">Start gesprek</button>
      </section>
    </main>
  );
}
```

Set up the same `@pixie-chat` alias in `vite.config.ts` and `tsconfig.app.json` so the kiosk can import the shared modules.

**Step 4: Run the smoke test**

Run:

```bash
npm run test:unit -- src/App.smoke.test.tsx
```

Expected:
- PASS for the basic render test.

**Step 5: Commit**

```bash
git add services/chat-kiosk-ui
git commit -m "feat: scaffold chat kiosk ui"
```

### Task 4: Add Direct `pixie-questioner` Integration and Session State

**Files:**
- Create: `services/chat-kiosk-ui/src/config.ts`
- Create: `services/chat-kiosk-ui/src/api/questioner.ts`
- Create: `services/chat-kiosk-ui/src/hooks/useKioskSession.ts`
- Create: `services/chat-kiosk-ui/src/api/questioner.test.ts`
- Create: `services/chat-kiosk-ui/src/hooks/useKioskSession.test.ts`
- Modify: `services/chat-kiosk-ui/src/App.tsx`

**Step 1: Write the failing tests**

One API test for the direct `/cases/{case_id}/chat` call and one hook test for session transitions:

```ts
it("posts directly to the configured questioner case endpoint", async () => {
  await sendQuestionerMessage({
    baseUrl: "https://questioner.example",
    caseId: "cretskens",
    currentAnswer: "Hallo",
    sessionId: "session-1",
    state: {},
  });

  expect(fetchMock).toHaveBeenCalledWith(
    "https://questioner.example/cases/cretskens/chat",
    expect.objectContaining({ method: "POST" }),
  );
});

it("moves from start to chatting when a session begins", async () => {
  const { result } = renderHook(() => useKioskSession());
  await act(async () => {
    await result.current.startConversation();
  });
  expect(result.current.phase).toBe("chatting");
});
```

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm run test:unit -- src/api/questioner.test.ts src/hooks/useKioskSession.test.ts
```

Expected:
- FAIL because the direct API client and kiosk session hook do not exist.

**Step 3: Implement the direct client and hook**

Keep config build-time only for v1:

```ts
// src/config.ts
export const kioskConfig = {
  questionerBaseUrl: requiredEnv("VITE_QUESTIONER_API_BASE_URL"),
  caseId: requiredEnv("VITE_QUESTIONER_CASE_ID"),
  idleTimeoutMs: numberEnv("VITE_KIOSK_IDLE_TIMEOUT_MS", 90000),
  resetDelayMs: numberEnv("VITE_KIOSK_RESET_DELAY_MS", 10000),
};
```

```ts
// src/api/questioner.ts
import { assertChatContractHeader } from "@pixie-chat/contractHeader";

export async function sendQuestionerMessage(input: SendQuestionerMessageInput) {
  const response = await fetch(
    `${input.baseUrl}/cases/${input.caseId}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_answer: input.currentAnswer,
        session_id: input.sessionId,
        state: input.state,
      }),
    },
  );

  const contractVersion = assertChatContractHeader(response.headers);
  const parsed = await response.json();
  return contractVersion ? { ...parsed, contract_version: contractVersion } : parsed;
}
```

```ts
// src/hooks/useKioskSession.ts
type KioskPhase = "start" | "chatting" | "completed" | "error";
```

Start with the smallest hook that can:
- start a new in-memory session;
- send a user message;
- store parsed assistant messages and quick replies;
- mark the flow `completed` when the parsed response is complete;
- reset back to `start`.

**Step 4: Run the focused tests**

Run:

```bash
npm run test:unit -- src/api/questioner.test.ts src/hooks/useKioskSession.test.ts
```

Expected:
- PASS for the API client and hook state transitions.

**Step 5: Commit**

```bash
git add services/chat-kiosk-ui/src/config.ts services/chat-kiosk-ui/src/api/questioner.ts services/chat-kiosk-ui/src/hooks/useKioskSession.ts services/chat-kiosk-ui/src/api/questioner.test.ts services/chat-kiosk-ui/src/hooks/useKioskSession.test.ts services/chat-kiosk-ui/src/App.tsx
git commit -m "feat: add kiosk questioner session flow"
```

### Task 5: Implement the Kiosk Screens, Timeout Reset, and Recovery States

**Files:**
- Create: `services/chat-kiosk-ui/src/components/StartScreen.tsx`
- Create: `services/chat-kiosk-ui/src/components/ChatScreen.tsx`
- Create: `services/chat-kiosk-ui/src/components/CompletedScreen.tsx`
- Create: `services/chat-kiosk-ui/src/components/ErrorScreen.tsx`
- Create: `services/chat-kiosk-ui/src/App.flow.test.tsx`
- Create: `services/chat-kiosk-ui/src/components/ChatScreen.test.tsx`
- Modify: `services/chat-kiosk-ui/src/App.tsx`
- Modify: `services/chat-kiosk-ui/src/index.css`
- Modify: `services/chat-kiosk-ui/src/hooks/useKioskSession.ts`

**Step 1: Write the failing UI flow tests**

Cover the three kiosk-specific behaviors that do not exist in `chat-ui`:

```tsx
it("shows the start screen first and enters chat after tapping start", async () => {
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Start gesprek" }));
  expect(screen.getByRole("textbox")).toBeInTheDocument();
});

it("returns to the start screen after the completed delay", async () => {
  vi.useFakeTimers();
  render(<App />);
  // drive the hook into completed state
  vi.advanceTimersByTime(10000);
  expect(screen.getByRole("button", { name: "Start gesprek" })).toBeInTheDocument();
});

it("resets the session after inactivity", async () => {
  vi.useFakeTimers();
  render(<App />);
  // enter chat first
  vi.advanceTimersByTime(90000);
  expect(screen.getByRole("button", { name: "Start gesprek" })).toBeInTheDocument();
});
```

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm run test:unit -- src/App.flow.test.tsx src/components/ChatScreen.test.tsx
```

Expected:
- FAIL because the dedicated screens, timers, and reset behavior do not exist yet.

**Step 3: Implement the kiosk UI and timer behavior**

Drive the app from `phase` and keep each screen dumb:

```tsx
// src/App.tsx
switch (session.phase) {
  case "start":
    return <StartScreen onStart={session.startConversation} />;
  case "chatting":
    return <ChatScreen session={session} />;
  case "completed":
    return <CompletedScreen onRestart={session.resetConversation} />;
  case "error":
    return <ErrorScreen error={session.error} onRetry={session.resetConversation} />;
}
```

In `useKioskSession`, add:
- an idle timeout that resets the session;
- a completed timeout that returns to start;
- a single recovery path for fetch/contract/parse failures.

Keep the visuals intentionally simple:
- large typography;
- large touch targets;
- no URL-driven state;
- no debug or location UI.

**Step 4: Run the focused tests and the kiosk unit suite**

Run:

```bash
npm run test:unit -- src/App.flow.test.tsx src/components/ChatScreen.test.tsx
npm run test:unit
```

Expected:
- PASS for the flow tests.
- PASS for the full kiosk unit suite.

**Step 5: Commit**

```bash
git add services/chat-kiosk-ui/src/components services/chat-kiosk-ui/src/App.tsx services/chat-kiosk-ui/src/index.css services/chat-kiosk-ui/src/hooks/useKioskSession.ts services/chat-kiosk-ui/src/App.flow.test.tsx services/chat-kiosk-ui/src/components/ChatScreen.test.tsx
git commit -m "feat: add kiosk screens and reset behavior"
```

### Task 6: Add Jetson Packaging, Deployment Notes, and Final Verification

**Files:**
- Create: `services/chat-kiosk-ui/Dockerfile`
- Create: `services/chat-kiosk-ui/.dockerignore`
- Create: `services/chat-kiosk-ui/nginx.conf`
- Create: `services/chat-kiosk-ui/README.md`
- Create: `services/chat-kiosk-ui/scripts/start-kiosk.sh`
- Modify: `README.md`

**Step 1: Write the failing build/runtime verification**

There is no test file here; the failing check is the missing packaging/runtime layer. Start by proving the app does not yet build into the intended lightweight artifact.

Run:

```bash
npm run build
docker build -t chat-kiosk-ui .
```

Expected:
- FAIL because the kiosk runtime files do not exist yet.

**Step 2: Implement the light runtime**

Use a multi-stage build so Node is only used at build time:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
```

Add `scripts/start-kiosk.sh` with the operational Chromium launch command:

```bash
#!/usr/bin/env sh
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  http://localhost:8080
```

Document the required env vars in `services/chat-kiosk-ui/README.md`:
- `VITE_QUESTIONER_API_BASE_URL`
- `VITE_QUESTIONER_CASE_ID`
- `VITE_KIOSK_IDLE_TIMEOUT_MS`
- `VITE_KIOSK_RESET_DELAY_MS`

Update the root `README.md` with a short section that explains:
- use case 1 stays on `chat-ui + chat-proxy`;
- use case 2 uses `chat-kiosk-ui`.

**Step 3: Run the full verification set**

Run:

```bash
cd /Users/drphil/Documents/Werk/pixie-chat-ui/.worktrees/feat-cretskens-kiosk/services/chat-ui && npm run test:unit
cd /Users/drphil/Documents/Werk/pixie-chat-ui/.worktrees/feat-cretskens-kiosk/services/chat-kiosk-ui && npm run test:unit
cd /Users/drphil/Documents/Werk/pixie-chat-ui/.worktrees/feat-cretskens-kiosk/services/chat-kiosk-ui && npm run build
cd /Users/drphil/Documents/Werk/pixie-chat-ui/.worktrees/feat-cretskens-kiosk/services/chat-kiosk-ui && docker build -t chat-kiosk-ui .
```

Expected:
- existing `chat-ui` unit tests stay green;
- kiosk unit tests stay green;
- kiosk production build succeeds;
- kiosk container build succeeds.

**Step 4: Commit**

```bash
git add services/chat-kiosk-ui/Dockerfile services/chat-kiosk-ui/.dockerignore services/chat-kiosk-ui/nginx.conf services/chat-kiosk-ui/README.md services/chat-kiosk-ui/scripts/start-kiosk.sh README.md
git commit -m "feat: package Cretskens kiosk ui"
```

**Step 5: Final review checkpoint**

Before merging or handing off:
- run `git status --short` and confirm only intended files changed;
- capture the exact verification output in the handoff note;
- note the Node requirement explicitly if the local machine is still below `20.19`.
