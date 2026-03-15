# Cretskens Wine Recommendations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render Cretskens recommendation responses as structured swipeable wine cards inside the kiosk chat screen instead of plain text only.

**Architecture:** Extend the shared response parser so it exposes a dedicated recommendation rich-content payload for Cretskens `type: "recommendations"` responses. Store that structured payload in the kiosk session hook, then render it in `ChatScreen` as a prominent recommendation section with horizontally scrollable cards and touch-friendly navigation while preserving the existing chat transcript for non-recommendation turns.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite, shared `@pixie-chat` parser utilities.

---

### Task 1: Parse structured recommendation content

**Files:**
- Modify: `shared/pixie-chat/responseParser.ts`
- Create: `services/chat-kiosk-ui/src/responseParser.recommendations.test.ts`

**Step 1: Write the failing test**

Create `services/chat-kiosk-ui/src/responseParser.recommendations.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { parsePixieChatResponse } from "@pixie-chat/responseParser";

describe("parsePixieChatResponse recommendations", () => {
  it("extracts structured Cretskens recommendation cards", () => {
    const parsed = parsePixieChatResponse({
      type: "recommendations",
      text: "Leuk, ik heb een paar mooie opties voor je klaargezet.",
      recommendations: [
        {
          name: "Domaine des Pins Sauvignon Blanc",
          country: "Frankrijk",
          region: "Loire",
          aroma_description: "Citrus en witte bloemen",
          taste_description: "Fris en strak",
        },
        {
          name: "Casa Azul Verdejo",
          country: "Spanje",
          region: "Rueda",
          aroma_description: "Tropisch fruit en venkel",
          taste_description: "Droog en rond",
        },
      ],
      conversation_id: "session-1",
      state: { phase: "completed" },
    });

    expect(parsed.content).toBe(
      "Leuk, ik heb een paar mooie opties voor je klaargezet.",
    );
    expect(parsed.isComplete).toBe(true);
    expect(parsed.quickReplies).toEqual([]);
    expect(parsed.richContent).toEqual({
      type: "wine_recommendations",
      intro: "Leuk, ik heb een paar mooie opties voor je klaargezet.",
      items: [
        {
          name: "Domaine des Pins Sauvignon Blanc",
          country: "Frankrijk",
          region: "Loire",
          aromaDescription: "Citrus en witte bloemen",
          tasteDescription: "Fris en strak",
        },
        {
          name: "Casa Azul Verdejo",
          country: "Spanje",
          region: "Rueda",
          aromaDescription: "Tropisch fruit en venkel",
          tasteDescription: "Droog en rond",
        },
      ],
    });
  });

  it("falls back cleanly when recommendations are missing", () => {
    const parsed = parsePixieChatResponse({
      type: "recommendations",
      text: "Hier zijn een paar opties.",
      conversation_id: "session-2",
      state: { phase: "completed" },
    });

    expect(parsed.content).toBe("Hier zijn een paar opties.");
    expect(parsed.richContent).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm --prefix services/chat-kiosk-ui run test:unit -- src/responseParser.recommendations.test.ts
```

Expected: FAIL because `PixieChatApiResponse` does not expose `recommendations`, `AssistantRichContent` has no `wine_recommendations` variant, and the parser does not build this rich content yet.

**Step 3: Write minimal implementation**

Update `shared/pixie-chat/responseParser.ts`:

- extend `AssistantRichContent` with a new variant
- extend `PixieChatApiResponse` with a `recommendations?: unknown` field
- add a small normalizer for recommendation arrays
- on `type === "recommendations"`, populate `richContent` when the normalized array is non-empty
- mark the response complete and suppress quick replies

Target shape:

```ts
export type WineRecommendationItem = {
  name: string;
  country: string;
  region: string;
  aromaDescription: string;
  tasteDescription: string;
};

export type AssistantRichContent =
  | {
      type: typeof SEARCH_RESULTS;
      results: SearchResultsResponse;
    }
  | {
      type: "wine_recommendations";
      intro: string;
      items: WineRecommendationItem[];
    };
```

Implementation notes:

- normalize API fields from snake_case to camelCase
- reject malformed items instead of emitting partial broken cards
- keep existing Brooklyn and search-result behavior unchanged

**Step 4: Run test to verify it passes**

Run:

```bash
npm --prefix services/chat-kiosk-ui run test:unit -- src/responseParser.recommendations.test.ts
```

Expected: PASS

**Step 5: Run nearby regression tests**

Run:

```bash
npm --prefix services/chat-kiosk-ui run test:unit -- src/hooks/useKioskSession.test.ts src/components/ChatScreen.test.tsx
```

Expected: PASS

**Step 6: Commit**

```bash
git add shared/pixie-chat/responseParser.ts services/chat-kiosk-ui/src/responseParser.recommendations.test.ts
git commit -m "feat: parse Cretskens recommendation rich content"
```

### Task 2: Store recommendation content in kiosk session state

**Files:**
- Modify: `services/chat-kiosk-ui/src/hooks/useKioskSession.ts`
- Modify: `services/chat-kiosk-ui/src/hooks/useKioskSession.test.ts`

**Step 1: Write the failing test**

Add a new test to `services/chat-kiosk-ui/src/hooks/useKioskSession.test.ts`:

```ts
it("stores structured recommendation content for completed Cretskens responses", async () => {
  const sendMessage = vi.fn().mockResolvedValue({
    type: "recommendations",
    text: "Leuk, ik heb een paar mooie opties voor je klaargezet.",
    recommendations: [
      {
        name: "Domaine des Pins Sauvignon Blanc",
        country: "Frankrijk",
        region: "Loire",
        aroma_description: "Citrus en witte bloemen",
        taste_description: "Fris en strak",
      },
    ],
    conversation_id: "session-1",
    state: { phase: "completed" },
  });

  const { result } = renderHook(() =>
    useKioskSession({
      config: kioskConfig,
      sendMessage,
    }),
  );

  act(() => {
    result.current.startConversation();
  });

  await act(async () => {
    await result.current.sendUserMessage("Ik zoek een frisse witte wijn");
  });

  expect(result.current.phase).toBe("completed");
  expect(result.current.recommendations).toEqual({
    intro: "Leuk, ik heb een paar mooie opties voor je klaargezet.",
    items: [
      {
        name: "Domaine des Pins Sauvignon Blanc",
        country: "Frankrijk",
        region: "Loire",
        aromaDescription: "Citrus en witte bloemen",
        tasteDescription: "Fris en strak",
      },
    ],
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm --prefix services/chat-kiosk-ui run test:unit -- src/hooks/useKioskSession.test.ts
```

Expected: FAIL because `useKioskSession` does not expose `recommendations` yet.

**Step 3: Write minimal implementation**

Update `services/chat-kiosk-ui/src/hooks/useKioskSession.ts`:

- add a `recommendations` state slot, initialized to `null`
- clear it on restart, start, errors, and non-recommendation turns
- when `parsed.richContent?.type === "wine_recommendations"`, store:

```ts
{
  intro: parsed.richContent.intro,
  items: parsed.richContent.items,
}
```

- keep the existing message transcript behavior intact
- preserve the existing completed-state timing behavior

Recommended exported type:

```ts
export type KioskRecommendations = {
  intro: string;
  items: WineRecommendationItem[];
};
```

**Step 4: Run test to verify it passes**

Run:

```bash
npm --prefix services/chat-kiosk-ui run test:unit -- src/hooks/useKioskSession.test.ts
```

Expected: PASS

**Step 5: Run nearby regression tests**

Run:

```bash
npm --prefix services/chat-kiosk-ui run test:unit -- src/responseParser.recommendations.test.ts src/components/ChatScreen.test.tsx
```

Expected: PASS

**Step 6: Commit**

```bash
git add services/chat-kiosk-ui/src/hooks/useKioskSession.ts services/chat-kiosk-ui/src/hooks/useKioskSession.test.ts
git commit -m "feat: store kiosk wine recommendations"
```

### Task 3: Render recommendation cards in the chat screen

**Files:**
- Modify: `services/chat-kiosk-ui/src/components/ChatScreen.tsx`
- Modify: `services/chat-kiosk-ui/src/components/ChatScreen.test.tsx`
- Modify: `services/chat-kiosk-ui/src/App.tsx`

**Step 1: Write the failing test**

Extend `services/chat-kiosk-ui/src/components/ChatScreen.test.tsx` with:

```tsx
it("renders Cretskens recommendation cards as structured results", () => {
  render(
    <ChatScreen
      title="Cretskens Assistent"
      messages={[
        { role: "assistant", content: "Welkom bij Cretskens" },
        { role: "user", content: "Ik zoek een frisse witte wijn" },
      ]}
      recommendations={{
        intro: "Leuk, ik heb een paar mooie opties voor je klaargezet.",
        items: [
          {
            name: "Domaine des Pins Sauvignon Blanc",
            country: "Frankrijk",
            region: "Loire",
            aromaDescription: "Citrus en witte bloemen",
            tasteDescription: "Fris en strak",
          },
          {
            name: "Casa Azul Verdejo",
            country: "Spanje",
            region: "Rueda",
            aromaDescription: "Tropisch fruit en venkel",
            tasteDescription: "Droog en rond",
          },
        ],
      }}
      quickReplies={[]}
      loading={false}
      onRestart={vi.fn()}
      onSendMessage={vi.fn()}
    />,
  );

  expect(
    screen.getByText("Leuk, ik heb een paar mooie opties voor je klaargezet."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Domaine des Pins Sauvignon Blanc" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Frankrijk · Loire")).toBeInTheDocument();
  expect(screen.getByText("Geur")).toBeInTheDocument();
  expect(screen.getByText("Smaak")).toBeInTheDocument();
  expect(screen.getByText("1 / 2")).toBeInTheDocument();
});
```

If navigation buttons are part of the first implementation, also assert:

```tsx
expect(screen.getByRole("button", { name: "Volgende wijn" })).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm --prefix services/chat-kiosk-ui run test:unit -- src/components/ChatScreen.test.tsx
```

Expected: FAIL because `ChatScreen` does not accept or render `recommendations`.

**Step 3: Write minimal implementation**

Update `services/chat-kiosk-ui/src/components/ChatScreen.tsx`:

- accept a new optional `recommendations` prop
- render a dedicated recommendation section inside the message viewport when present
- keep existing chat messages above the recommendation section
- use semantic headings for wine names
- show metadata line as `country · region`
- show labeled `Geur` and `Smaak` blocks
- add a simple progress indicator based on the active card
- add navigation controls only if they are simple and testable in the first pass

Suggested render structure:

```tsx
<section className="chat-screen__recommendations" aria-label="Wijnsuggesties">
  <header className="chat-screen__recommendations-header">
    <p>{recommendations.intro}</p>
    <span>1 / {recommendations.items.length}</span>
  </header>
  <div className="chat-screen__recommendation-rail">
    {recommendations.items.map((item) => (
      <article className="chat-screen__recommendation-card" key={...}>
        ...
      </article>
    ))}
  </div>
</section>
```

Update `services/chat-kiosk-ui/src/App.tsx` to pass `session.recommendations` into `ChatScreen`.

Do not move recommendations to `CompletedScreen`; this feature belongs inside the chat experience.

**Step 4: Run test to verify it passes**

Run:

```bash
npm --prefix services/chat-kiosk-ui run test:unit -- src/components/ChatScreen.test.tsx
```

Expected: PASS

**Step 5: Run nearby regression tests**

Run:

```bash
npm --prefix services/chat-kiosk-ui run test:unit -- src/hooks/useKioskSession.test.ts src/App.flow.test.tsx src/App.smoke.test.tsx
```

Expected: PASS

**Step 6: Commit**

```bash
git add services/chat-kiosk-ui/src/components/ChatScreen.tsx services/chat-kiosk-ui/src/components/ChatScreen.test.tsx services/chat-kiosk-ui/src/App.tsx
git commit -m "feat: render Cretskens recommendation cards"
```

### Task 4: Style the recommendation rail for kiosk use

**Files:**
- Modify: `services/chat-kiosk-ui/src/index.css`
- Modify: `services/chat-kiosk-ui/src/components/ChatScreen.test.tsx`

**Step 1: Write the failing test**

Add assertions in `services/chat-kiosk-ui/src/components/ChatScreen.test.tsx` that the recommendation rail and cards render with dedicated classes:

```tsx
const { container } = render(/* same recommendation scenario */);

expect(
  container.querySelector(".chat-screen__recommendation-rail"),
).toBeInTheDocument();
expect(
  container.querySelector(".chat-screen__recommendation-card"),
).toBeInTheDocument();
```

If you add navigation controls, also assert their presence by accessible name.

**Step 2: Run test to verify it fails**

Run:

```bash
npm --prefix services/chat-kiosk-ui run test:unit -- src/components/ChatScreen.test.tsx
```

Expected: FAIL until the final DOM structure and classes are in place.

**Step 3: Write minimal implementation**

Update `services/chat-kiosk-ui/src/index.css` with dedicated styles for:

- `.chat-screen__recommendations`
- `.chat-screen__recommendations-header`
- `.chat-screen__recommendation-progress`
- `.chat-screen__recommendation-rail`
- `.chat-screen__recommendation-card`
- `.chat-screen__recommendation-origin`
- `.chat-screen__recommendation-sensory-grid`
- `.chat-screen__recommendation-sensory-block`

Styling requirements:

- horizontal scrolling with scroll snap
- one dominant card with a visible peek of the next card
- strong typography for wine names
- compact, readable sensory sections
- layout remains usable below `720px`
- preserve existing kiosk palette and spacing rhythm

If controls are added, style them as subtle secondary buttons.

**Step 4: Run test to verify it passes**

Run:

```bash
npm --prefix services/chat-kiosk-ui run test:unit -- src/components/ChatScreen.test.tsx
```

Expected: PASS

**Step 5: Run full kiosk verification**

Run:

```bash
npm --prefix services/chat-kiosk-ui run test:unit
npm --prefix services/chat-kiosk-ui run build
```

Expected: all unit tests PASS and the Vite build succeeds

**Step 6: Commit**

```bash
git add services/chat-kiosk-ui/src/index.css services/chat-kiosk-ui/src/components/ChatScreen.test.tsx
git commit -m "style: add kiosk recommendation rail layout"
```

### Task 5: Final review and integration check

**Files:**
- Review only: `docs/plans/2026-03-15-cretskens-wine-recommendations-design.md`
- Review only: `docs/plans/2026-03-15-cretskens-wine-recommendations-implementation.md`

**Step 1: Verify git state**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: only intended files changed and task commits present in order

**Step 2: Manual sanity review**

Check:

- recommendation responses still show assistant intro text
- recommendation cards do not replace historical user messages
- normal non-recommendation chat turns still render as before
- the reset button remains available

**Step 3: Optional browser verification**

Run:

```bash
npm --prefix services/chat-kiosk-ui run dev
```

Then verify the recommendation rail visually in a browser using a mocked or live Cretskens response.

**Step 4: Prepare handoff**

Summarize:

- parser contract assumptions
- UI behavior on recommendation turns
- any intentional omissions such as navigation controls deferred to a later pass

