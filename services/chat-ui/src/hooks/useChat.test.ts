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
});
