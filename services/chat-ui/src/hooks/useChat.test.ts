import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendChatMessage } from "../api/chat";
import { useChat } from "./useChat";

vi.mock("../api/chat", () => ({
  sendChatMessage: vi.fn(),
}));

const mockedSendChatMessage = vi.mocked(sendChatMessage);

describe("useChat quick replies", () => {
  beforeEach(() => {
    mockedSendChatMessage.mockReset();
  });

  it("stores active quick replies from assistant response", async () => {
    mockedSendChatMessage.mockResolvedValue({
      type: "answer",
      text: "Wil je verdergaan?",
      quick_replies: [
        { label: "Ja", value: "yes" },
        { label: "Nee", value: "no" },
      ],
      conversation_id: "session-1",
      state: {},
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hallo");
    });

    expect(result.current.activeQuickReplies).toEqual([
      { label: "Ja", value: "yes" },
      { label: "Nee", value: "no" },
    ]);
    expect(result.current.messages.map((message) => message.content)).toEqual([
      "Hallo",
      "Wil je verdergaan?",
    ]);
  });

  it("clears quick replies after sending a follow-up answer", async () => {
    mockedSendChatMessage
      .mockResolvedValueOnce({
        type: "answer",
        text: "Wil je verdergaan?",
        quick_replies: [
          { label: "Ja", value: "yes" },
          { label: "Nee", value: "no" },
        ],
        conversation_id: "session-1",
        state: {},
      })
      .mockResolvedValueOnce({
        type: "answer",
        text: "Bedankt.",
        conversation_id: "session-1",
        state: {},
      });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hallo");
    });
    expect(result.current.activeQuickReplies).toHaveLength(2);

    await act(async () => {
      await result.current.sendMessage("yes");
    });

    expect(result.current.activeQuickReplies).toEqual([]);
    expect(mockedSendChatMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ currentAnswer: "yes" }),
    );
  });

  it("clears quick replies when send fails", async () => {
    mockedSendChatMessage
      .mockResolvedValueOnce({
        type: "answer",
        text: "Wil je verdergaan?",
        quick_replies: [
          { label: "Ja", value: "yes" },
          { label: "Nee", value: "no" },
        ],
        conversation_id: "session-1",
        state: {},
      })
      .mockRejectedValueOnce(new Error("Netwerkfout"));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hallo");
    });
    expect(result.current.activeQuickReplies).toHaveLength(2);

    await act(async () => {
      await result.current.sendMessage("yes");
    });

    expect(result.current.activeQuickReplies).toEqual([]);
    expect(result.current.error).toBe("Netwerkfout");
  });

  it("includes debug_mode in request state when debug is enabled", async () => {
    mockedSendChatMessage.mockResolvedValue({
      type: "answer",
      text: "Debug staat aan.",
      conversation_id: "session-1",
      state: { phase: "intake" },
    });

    const { result } = renderHook(() => useChat(undefined, undefined, { debugModeEnabled: true }));

    await act(async () => {
      await result.current.sendMessage("Hallo");
    });

    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({ debug_mode: true }),
      }),
    );
  });

  it("shows a compact debug message when state contains a debug trace", async () => {
    mockedSendChatMessage.mockResolvedValue({
      type: "question",
      text: "Wat is je budget?",
      conversation_id: "session-1",
      state: {
        debug: {
          enabled: true,
          trace: [
            {
              turn: 2,
              action: "question",
              meal_mode: "drinking_only",
              controller_explanation: "Budget preference is still missing.",
              question_text: "Wat is je budget?",
            },
          ],
        },
      },
    });

    const { result } = renderHook(() => useChat(undefined, undefined, { debugModeEnabled: true }));

    await act(async () => {
      await result.current.sendMessage("Gewoon los drinken");
    });

    const assistantMessages = result.current.messages.filter((message) => message.role === "assistant");
    expect(assistantMessages.at(-1)?.variant).toBe("debug");
    expect(assistantMessages.at(-1)?.content).toContain("Budget preference is still missing.");
  });
});
