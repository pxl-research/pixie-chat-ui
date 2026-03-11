# Kiosk UX Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recover the misplaced UX polish from `chat-ui` and apply only the parts that make sense to the Cretskens kiosk flow.

**Architecture:** Keep `services/chat-ui` visually unchanged, move the intended UX improvements into `services/chat-kiosk-ui`, and extend the kiosk configuration so the portrait-first experience can use the real Cretskens branding and same-origin deployment setup. Drive the work with tests that fail on the current kiosk behavior and pass once the kiosk-only changes are in place.

**Tech Stack:** React 19, Vite 7, Vitest, Nginx, Docker

---

### Task 1: Lock down the desired kiosk UX in tests

**Files:**
- Modify: `services/chat-kiosk-ui/src/App.smoke.test.tsx`
- Modify: `services/chat-kiosk-ui/src/App.flow.test.tsx`
- Modify: `services/chat-kiosk-ui/src/components/ChatScreen.test.tsx`
- Modify: `services/chat-kiosk-ui/src/api/questioner.test.ts`
- Create: `services/chat-kiosk-ui/src/config.test.ts`

**Step 1: Write failing tests**
- Assert the start screen renders the Cretskens branding copy, hero image, and helper text.
- Assert the app shell switches between `start` and `chat` layout classes.
- Assert the chat screen renders the portrait-first viewport/action rail.
- Assert the questioner client normalizes same-origin base URLs with trailing slashes.
- Assert the kiosk copy config returns Cretskens defaults and supports env overrides.

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/App.smoke.test.tsx src/App.flow.test.tsx src/components/ChatScreen.test.tsx src/api/questioner.test.ts src/config.test.ts`

Expected: failures for missing kiosk copy config, layout classes, and same-origin URL normalization.

### Task 2: Port the kiosk-only UX and deployment changes

**Files:**
- Modify: `services/chat-kiosk-ui/src/App.tsx`
- Modify: `services/chat-kiosk-ui/src/components/StartScreen.tsx`
- Modify: `services/chat-kiosk-ui/src/components/ChatScreen.tsx`
- Modify: `services/chat-kiosk-ui/src/components/CompletedScreen.tsx`
- Modify: `services/chat-kiosk-ui/src/components/ErrorScreen.tsx`
- Modify: `services/chat-kiosk-ui/src/config.ts`
- Modify: `services/chat-kiosk-ui/src/env.d.ts`
- Modify: `services/chat-kiosk-ui/src/api/questioner.ts`
- Modify: `services/chat-kiosk-ui/src/index.css`
- Modify: `services/chat-kiosk-ui/nginx.conf`
- Modify: `services/chat-kiosk-ui/Dockerfile`
- Modify: `services/chat-kiosk-ui/README.md`
- Create: `services/chat-kiosk-ui/docker-compose.kiosk.yml`

**Step 1: Write minimal implementation**
- Add kiosk copy/branding config and same-origin questioner support.
- Move the portrait-first full-screen layout and Cretskens copy into kiosk components.
- Adapt the visual polish from the mistaken `chat-ui` CSS only where it improves kiosk controls, messages, and hierarchy.
- Keep completion/error states aligned with kiosk branding.
- Add Docker/Nginx support for same-origin `/questioner` requests and an explicit branding mount path for local container runs.

**Step 2: Run focused kiosk tests**

Run: `npm run test:unit`

Expected: all kiosk tests pass.

### Task 3: Restore the non-kiosk UI and verify both apps

**Files:**
- Restore: `services/chat-ui/src/App.css`

**Step 1: Remove the misplaced UX changes**
- Restore `services/chat-ui/src/App.css` to the committed branch version.

**Step 2: Verify both apps**

Run:
- `npm run test:unit` in `services/chat-ui`
- `npm run build` in `services/chat-ui`
- `npm run test:unit` in `services/chat-kiosk-ui`
- `VITE_QUESTIONER_API_BASE_URL=/questioner VITE_QUESTIONER_CASE_ID=cretskens npm run build` in `services/chat-kiosk-ui`

Expected: both apps stay green, with kiosk-only behavior changing.
