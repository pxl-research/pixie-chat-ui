import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useKioskSession } from "./useKioskSession";

const kioskConfig = {
  questionerBaseUrl: "https://questioner.example",
  caseId: "cretskens",
  idleTimeoutMs: 90_000,
  resetDelayMs: 10_000,
};

describe("useKioskSession", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

    expect(result.current.phase).toBe("chatting");
    expect(result.current.messages.map((message) => message.content)).toEqual([
      "Ik zoek een frisse witte wijn",
    ]);
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
    expect(result.current.followUpQuestion).toBeNull();
  });

  it("shows follow-up question alongside recommendations and keeps cards visible during feedback", async () => {
    const recommendationsResponse = {
      type: "recommendations",
      text: "Hier zijn mijn suggesties.",
      recommendations: [
        {
          name: "Domaine des Pins Sauvignon Blanc",
          country: "Frankrijk",
          region: "Loire",
          aroma_description: "Citrus en witte bloemen",
          taste_description: "Fris en strak",
        },
      ],
      follow_up_question: "Hoe tevreden ben je met deze suggesties?",
      quick_replies: [
        { label: "1", value: "1" },
        { label: "2", value: "2" },
      ],
      conversation_id: "session-1",
      state: {},
    };
    const feedbackResponse = {
      type: "answer",
      text: "Bedankt! Nog een vraag.",
      quick_replies: [
        { label: "Ja", value: "ja" },
        { label: "Nee", value: "nee" },
      ],
      conversation_id: "session-1",
      state: {},
    };
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(recommendationsResponse)
      .mockResolvedValueOnce(feedbackResponse);

    const { result } = renderHook(() =>
      useKioskSession({ config: kioskConfig, sendMessage }),
    );

    act(() => {
      result.current.startConversation();
    });

    // First turn: recommendations + follow-up question
    await act(async () => {
      await result.current.sendUserMessage("Ik zoek een frisse witte wijn");
    });

    expect(result.current.recommendations).not.toBeNull();
    expect(result.current.followUpQuestion).toBe("Hoe tevreden ben je met deze suggesties?");
    // Follow-up question is NOT in messages array (it's rendered separately after cards)
    expect(result.current.messages.map((m) => m.content)).not.toContain(
      "Hoe tevreden ben je met deze suggesties?",
    );

    // Second turn: answer feedback question — recommendations must stay visible
    await act(async () => {
      await result.current.sendUserMessage("2");
    });

    expect(result.current.recommendations).not.toBeNull();
    expect(result.current.followUpQuestion).toBe("Bedankt! Nog een vraag.");
    // Feedback question is NOT in messages either
    expect(result.current.messages.map((m) => m.content)).not.toContain(
      "Bedankt! Nog een vraag.",
    );
    // User answers are still in messages
    expect(result.current.messages.map((m) => m.content)).toContain("2");
  });

  it("returns to the start phase after the completed delay", async () => {
    vi.useFakeTimers();

    const sendMessage = vi.fn().mockResolvedValue({
      type: "summary",
      text: "Bedankt voor je bezoek",
      summary: "Samenvatting",
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
      await result.current.sendUserMessage("Hallo");
    });

    expect(result.current.phase).toBe("completed");

    act(() => {
      vi.advanceTimersByTime(kioskConfig.resetDelayMs);
    });

    expect(result.current.phase).toBe("start");
  });

  it("resets the session after inactivity", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useKioskSession({
        config: kioskConfig,
        sendMessage: vi.fn(),
      }),
    );

    act(() => {
      result.current.startConversation();
    });

    expect(result.current.phase).toBe("chatting");

    act(() => {
      vi.advanceTimersByTime(kioskConfig.idleTimeoutMs);
    });

    expect(result.current.phase).toBe("start");
    expect(result.current.messages).toEqual([]);
  });
});
