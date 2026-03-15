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
    expect(parsed.isComplete).toBe(false);
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
