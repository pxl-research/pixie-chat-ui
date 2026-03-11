import { describe, expect, it } from "vitest";

import { parsePixieChatResponse } from "@pixie-chat/responseParser";
import { parseApiResponse } from "./responseParser";

describe("parseApiResponse quick replies", () => {
  it("normalizes quick replies via the shared parser", () => {
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

  it("normalizes string quick replies with trim, dedupe and max 6", () => {
    const parsed = parseApiResponse({
      type: "answer",
      text: "Wil je doorgaan?",
      quick_replies: ["  Ja  ", "Nee", "ja", "Optie 3", "Optie 4", "Optie 5", "Optie 6", "Optie 7", "  "],
      conversation_id: "session-1",
      state: {},
    });

    expect(parsed.quickReplies).toEqual([
      { label: "Ja", value: "Ja" },
      { label: "Nee", value: "Nee" },
      { label: "Optie 3", value: "Optie 3" },
      { label: "Optie 4", value: "Optie 4" },
      { label: "Optie 5", value: "Optie 5" },
      { label: "Optie 6", value: "Optie 6" },
    ]);
  });

  it("normalizes object quick replies and falls back to label when value is missing", () => {
    const parsed = parseApiResponse({
      type: "answer",
      text: "Choose one",
      options: [
        { label: "Yes", value: "yes" },
        { label: "No" },
        { text: "Maybe", value: "maybe" },
        { label: " ", value: "ignored" },
      ],
      conversation_id: "session-2",
      state: {},
    });

    expect(parsed.quickReplies).toEqual([
      { label: "Yes", value: "yes" },
      { label: "No", value: "No" },
      { label: "Maybe", value: "maybe" },
    ]);
  });

  it("does not expose quick replies when conversation is complete", () => {
    const parsed = parseApiResponse({
      type: "summary",
      text: "Bedankt voor je feedback.",
      summary: "Samenvatting",
      quick_replies: ["Ja", "Nee"],
      conversation_id: "session-3",
      state: { phase: "completed" },
    });

    expect(parsed.isComplete).toBe(true);
    expect(parsed.quickReplies).toEqual([]);
  });

  it("keeps text, summary and follow-up question together on answer turns", () => {
    const parsed = parseApiResponse({
      type: "answer",
      text: "Dank je wel",
      summary: "Je zoekt een jeans met rechte fit.",
      follow_up_question: "Zou je deze assistent opnieuw gebruiken?",
      quick_replies: [
        { label: "Ja", value: "yes" },
        { label: "Nee", value: "no" },
      ],
      conversation_id: "session-4",
      state: { feedback_requested: "true" },
    });

    expect(parsed.content).toBe("Dank je wel");
    expect(parsed.summaryContent).toBe("Je zoekt een jeans met rechte fit.");
    expect(parsed.followUpQuestionContent).toBe("Zou je deze assistent opnieuw gebruiken?");
    expect(parsed.quickReplies).toEqual([
      { label: "Ja", value: "yes" },
      { label: "Nee", value: "no" },
    ]);
  });
});
