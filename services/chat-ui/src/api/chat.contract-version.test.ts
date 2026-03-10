import { afterEach, describe, expect, it, vi } from "vitest";

import { assertChatContractHeader } from "@pixie-chat/contractHeader";

describe("sendChatMessage contract version", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@pixie-chat/contractHeader");
    vi.unstubAllGlobals();
  });

  it("accepts chat-v2.0.0 contract headers via the shared contract helper", () => {
    expect(() =>
      assertChatContractHeader(
        new Headers({
          "X-Pixie-Chat-Contract": "chat-v2.0.0",
        }),
      ),
    ).not.toThrow();
  });

  it("accepts questioner responses with chat-v2.0.0 contract headers", async () => {
    const { sendChatMessage } = await import("./chat");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "answer",
          text: "ok",
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

    const result = await sendChatMessage({
      currentAnswer: "Hallo",
      sessionId: "session-1",
      state: {},
    });

    expect(result.contract_version).toBe("chat-v2.0.0");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("delegates contract header validation to the shared helper", async () => {
    const sharedHeaderValidator = vi.fn().mockReturnValue("chat-v2.0.0");
    vi.doMock("@pixie-chat/contractHeader", () => ({
      assertChatContractHeader: sharedHeaderValidator,
    }));

    const { sendChatMessage } = await import("./chat");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "answer",
          text: "ok",
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

    const result = await sendChatMessage({
      currentAnswer: "Hallo",
      sessionId: "session-1",
      state: { debug_mode: true },
    });

    expect(sharedHeaderValidator).toHaveBeenCalledTimes(1);
    const [forwardedHeaders] = sharedHeaderValidator.mock.calls[0];
    expect(forwardedHeaders.get("X-Pixie-Chat-Contract")).toBe("chat-v2.0.0");
    expect(result.contract_version).toBe("chat-v2.0.0");
  });
});
