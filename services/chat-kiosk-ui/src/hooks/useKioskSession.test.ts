import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useKioskSession } from "./useKioskSession";

const kioskConfig = {
  questionerBaseUrl: "https://questioner.example",
  caseId: "cretskens",
  idleTimeoutMs: 90_000,
  resetDelayMs: 10_000,
};

describe("useKioskSession", () => {
  it("moves from start to chatting when a session begins", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useKioskSession({
        config: kioskConfig,
        sendMessage,
      }),
    );

    await act(async () => {
      result.current.startConversation();
    });

    expect(result.current.phase).toBe("chatting");
    expect(result.current.sessionId).toBeTruthy();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("stores assistant messages and quick replies from direct questioner responses", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      type: "answer",
      text: "Welkom bij Cretskens",
      quick_replies: [
        { label: "Ja", value: "yes" },
        { label: "Nee", value: "no" },
      ],
      conversation_id: "session-1",
      state: {},
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
      await result.current.sendUserMessage("Hallo");
    });

    expect(result.current.phase).toBe("chatting");
    expect(result.current.messages.map((message) => message.content)).toEqual([
      "Hallo",
      "Welkom bij Cretskens",
    ]);
    expect(result.current.quickReplies).toEqual([
      { label: "Ja", value: "yes" },
      { label: "Nee", value: "no" },
    ]);
  });
});
