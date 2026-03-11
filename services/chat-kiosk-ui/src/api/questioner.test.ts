import { afterEach, describe, expect, it, vi } from "vitest";

import { sendQuestionerMessage } from "./questioner";

describe("sendQuestionerMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts directly to the configured questioner case endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "answer",
          text: "Welkom",
          conversation_id: "session-1",
          state: {},
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Pixie-Chat-Contract": "chat-v2.0.0",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendQuestionerMessage({
      baseUrl: "https://questioner.example",
      caseId: "cretskens",
      currentAnswer: "Hallo",
      sessionId: "session-1",
      state: { turn: 1 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://questioner.example/cases/cretskens/chat",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_answer: "Hallo",
          session_id: "session-1",
          state: { turn: 1 },
        }),
      }),
    );
  });

  it("normalizes same-origin base URLs with a trailing slash", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "answer",
          text: "Welkom",
          conversation_id: "session-1",
          state: {},
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Pixie-Chat-Contract": "chat-v2.0.0",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendQuestionerMessage({
      baseUrl: "/questioner/",
      caseId: "cretskens",
      currentAnswer: "Hallo",
      sessionId: "session-1",
      state: {},
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/questioner/cases/cretskens/chat",
      expect.any(Object),
    );
  });
});
