# Cretskens Wine Recommendations Design

**Date:** 2026-03-15

**Status:** Approved for planning

## Goal

Present Cretskens wine recommendations as a visually strong end-state inside the kiosk chat flow, using the structured `recommendations` payload instead of a plain text list.

## Context

The kiosk currently renders all assistant output as regular chat bubbles. This works for intake questions, but it is a poor fit for the Cretskens completion state where the backend returns 4-5 concrete wine suggestions.

The current Cretskens v2 contract now exposes structured recommendation data:

- `name`
- `country`
- `region`
- `aroma_description`
- `taste_description`

This makes it possible to move from “text transcript” to “result presentation” without needing images.

## Problem Statement

When recommendations are shown as plain text:

- users must read through a long bubble instead of scanning options
- comparison between wines is harder than necessary
- the end of the conversation does not feel like a meaningful result state
- the kiosk experience feels closer to a debug transcript than a guided retail interaction

## UX Decision

Use a dedicated recommendation presentation inside the existing chat screen.

This is not a separate page and not a fullscreen takeover. The chat remains visible as context, but the recommendation output becomes the visual focus through a structured result section.

The recommendation section should appear when the assistant receives a Cretskens response with `type: "recommendations"`.

## Rejected Alternatives

### 1. Keep recommendations as a normal chat bubble

Rejected because it preserves the current readability problem and underuses the structured payload.

### 2. Show all wines in a dense grid

Rejected because it becomes visually busy on kiosk-sized layouts once aroma and taste text are included. It also weakens the sense of progression from intake to result.

### 3. Use a pure one-card-at-a-time carousel

Rejected because it looks attractive but makes comparison slower than necessary. It is too sequential for a result set of 4-5 items.

## Chosen Direction

Use a hybrid recommendation rail:

- a short introductory block using the assistant text
- a horizontally scrollable row of wine cards
- one dominant card in view at a time on narrow layouts
- a visible peek of the next card to suggest swipe interaction
- optional previous/next controls for non-touch interaction
- subtle progress indicator such as dots or `1 / 5`

This preserves focus while keeping the set easy to scan.

## Information Architecture

The chat screen keeps three content layers:

1. Header
2. Message viewport
3. Action rail / composer area

Within the message viewport, recommendations become a first-class assistant content block instead of a plain `<p>` text node.

Recommended rendering order:

1. prior user and assistant messages
2. recommendation intro block
3. recommendation card rail

The raw text list produced by the backend should not be used as the primary UI when structured recommendations are available.

## Recommendation Card Content

Each wine card should show:

- wine name as the main heading
- country and region on a compact metadata line
- a labeled `Geur` section
- a labeled `Smaak` section

The card should not invent missing data. If a field is absent in a future response, the related section should be omitted cleanly rather than filled with placeholder copy.

## Visual Direction

The current kiosk already uses a warm, dark Cretskens palette. The recommendation cards should stay within that language and feel more like tactile retail labels than generic app cards.

Visual characteristics:

- warm cream text on deep brown surfaces
- soft metallic amber accents
- large typographic hierarchy for wine names
- generous spacing
- slightly elevated cards with low-gloss borders
- compact sensory sections with clear labels, not long prose paragraphs

Because no bottle images are available, the design should lean into typography and material treatment instead of reserving empty image slots.

## Behavior

### Desktop / landscape kiosk

- card rail scrolls horizontally
- one main card and part of the next card remain visible
- previous/next controls may be shown

### Mobile / narrow layouts

- card rail remains swipeable
- cards fill most of the width
- comparison remains possible by short swipes

### Completion state

When recommendations are shown, the conversation is complete:

- quick replies disappear
- the restart action remains available
- the composer may remain visible for layout consistency, but it should not compete visually with the recommendation result

## Accessibility

The recommendation rail should remain keyboard reachable:

- controls must be focusable
- card content must remain readable without hover
- progress indicator must not be color-only

If navigation buttons are added, they need accessible labels such as “Vorige wijn” and “Volgende wijn”.

## Data Handling

The shared response parser should expose structured recommendation content explicitly instead of forcing the kiosk to infer it from `text`.

The kiosk session hook should store recommendation content alongside regular messages so the chat screen can render a dedicated result block.

The design assumes this structured content shape:

```ts
type WineRecommendation = {
  name: string;
  country: string;
  region: string;
  aromaDescription: string;
  tasteDescription: string;
};
```

## Error Handling

If the response type is `recommendations` but the array is missing or empty:

- fall back to the assistant text bubble
- do not render an empty card rail

This keeps the kiosk usable even if upstream data is malformed.

## Testing Strategy

The implementation should be covered by:

- parser tests for structured recommendation extraction
- hook tests for storing recommendation state
- component tests for rendering recommendation cards and navigation affordances
- smoke verification that standard chat behavior still works for non-recommendation turns

## Success Criteria

The design is successful when:

- recommendation responses no longer render as plain text only
- users can scan the suggested wines quickly
- aroma and taste information is visible without opening extra detail views
- the chat still behaves correctly for normal question turns
- the result state feels deliberate and premium on kiosk hardware
