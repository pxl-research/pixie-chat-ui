import { useState, type FormEvent } from "react";

import type { QuickReplyOption } from "@pixie-chat/responseParser";

import type { KioskMessage } from "../hooks/useKioskSession";

type ChatScreenProps = {
  title: string;
  messages: KioskMessage[];
  quickReplies: QuickReplyOption[];
  loading: boolean;
  onRestart: () => void;
  onSendMessage: (value: string) => Promise<void> | void;
};

export function ChatScreen({
  title,
  messages,
  quickReplies,
  loading,
  onRestart,
  onSendMessage,
}: ChatScreenProps) {
  const [draft, setDraft] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDraft = draft.trim();
    if (!trimmedDraft) {
      return;
    }

    setDraft("");
    await onSendMessage(trimmedDraft);
  }

  return (
    <section className="kiosk-screen kiosk-screen--chat">
      <header className="chat-screen__header">
        <div>
          <p className="kiosk-screen__eyebrow">Cretskens</p>
          <h1 className="chat-screen__title">{title}</h1>
        </div>
        <button type="button" className="chat-screen__ghost-button" onClick={onRestart}>
          Reset
        </button>
      </header>

      <div className="chat-screen__messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <p className="chat-screen__empty">Typ een bericht of kies een snelle optie om te starten.</p>
        ) : (
          messages.map((message, index) => (
            <article
              key={`${message.role}-${index}-${message.content}`}
              className={`chat-screen__message chat-screen__message--${message.role}`}
            >
              <span className="chat-screen__role">
                {message.role === "assistant" ? title : "Jij"}
              </span>
              <p>{message.content}</p>
            </article>
          ))
        )}
      </div>

      {quickReplies.length > 0 ? (
        <div className="chat-screen__quick-replies" aria-label="Snelle antwoordopties">
          {quickReplies.map((reply) => (
            <button
              key={`${reply.label}-${reply.value}`}
              type="button"
              className="chat-screen__quick-reply"
              onClick={() => onSendMessage(reply.value)}
              disabled={loading}
            >
              {reply.label}
            </button>
          ))}
        </div>
      ) : null}

      <form className="chat-screen__composer" onSubmit={handleSubmit}>
        <label className="chat-screen__label" htmlFor="chat-message">
          Bericht
        </label>
        <div className="chat-screen__composer-row">
          <input
            id="chat-message"
            aria-label="Bericht"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={loading}
            placeholder={loading ? "Antwoord laden..." : "Typ je bericht"}
          />
          <button
            type="submit"
            className="kiosk-primary-button"
            disabled={loading || draft.trim().length === 0}
          >
            Versturen
          </button>
        </div>
      </form>
    </section>
  );
}
