import { useEffect, useRef, useState, type FormEvent } from "react";

import type { QuickReplyOption } from "@pixie-chat/responseParser";

import type { KioskMessage, KioskRecommendations } from "../hooks/useKioskSession";

type ChatScreenProps = {
  brandLabel?: string;
  logoUrl?: string;
  title: string;
  welcomeMessage?: string;
  messages: KioskMessage[];
  recommendations?: KioskRecommendations | null;
  quickReplies: QuickReplyOption[];
  loading: boolean;
  onRestart: () => void;
  onSendMessage: (value: string) => Promise<void> | void;
};

export function ChatScreen({
  brandLabel = "CRETSKENS",
  logoUrl,
  title,
  welcomeMessage,
  messages,
  recommendations,
  quickReplies,
  loading,
  onRestart,
  onSendMessage,
}: ChatScreenProps) {
  const [draft, setDraft] = useState("");
  const [activeRecommendationIndex, setActiveRecommendationIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recommendationCardRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  useEffect(() => {
    setActiveRecommendationIndex(0);
  }, [recommendations]);

  useEffect(() => {
    if (!recommendations || recommendations.items.length === 0) {
      return;
    }

    recommendationCardRefs.current[activeRecommendationIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeRecommendationIndex, recommendations]);

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
        <div className="chat-screen__brand">
          {logoUrl ? (
            <img className="chat-screen__brandmark" src={logoUrl} alt={brandLabel} />
          ) : null}
          <div className="chat-screen__brand-text">
            <h1 className="chat-screen__title">{title}</h1>
            <span className="chat-screen__status-pill">
              <span className="chat-screen__status-dot" />
              Online
            </span>
          </div>
        </div>
        <button type="button" className="chat-screen__ghost-button" onClick={onRestart} aria-label="Gesprek opnieuw starten">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 1 3 6.36" />
            <polyline points="3 22 3 16 9 16" />
          </svg>
          Opnieuw
        </button>
      </header>

      <div className="chat-screen__viewport">
        <div className="chat-screen__messages" role="log" aria-live="polite">
          {welcomeMessage && (
            <article className="chat-screen__message chat-screen__message--welcome">
              <span className="chat-screen__role">{title}</span>
              <p>{welcomeMessage}</p>
            </article>
          )}
          {messages.length === 0 && !welcomeMessage ? (
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
          {recommendations && recommendations.items.length > 0 ? (
            <section
              className="chat-screen__recommendations"
              aria-label="Wijnsuggesties"
            >
              <div className="chat-screen__recommendations-header">
                <div className="chat-screen__recommendation-controls">
                  <button
                    type="button"
                    className="chat-screen__recommendation-nav"
                    onClick={() =>
                      setActiveRecommendationIndex((current) => Math.max(0, current - 1))
                    }
                    disabled={activeRecommendationIndex === 0}
                    aria-label="Vorige wijn"
                  >
                    Vorige
                  </button>
                  <button
                    type="button"
                    className="chat-screen__recommendation-nav"
                    onClick={() =>
                      setActiveRecommendationIndex((current) =>
                        Math.min(recommendations.items.length - 1, current + 1),
                      )
                    }
                    disabled={
                      activeRecommendationIndex === recommendations.items.length - 1
                    }
                    aria-label="Volgende wijn"
                  >
                    Volgende
                  </button>
                </div>
                <span className="chat-screen__recommendation-progress">
                  {activeRecommendationIndex + 1} / {recommendations.items.length}
                </span>
              </div>
              <div className="chat-screen__recommendation-rail">
                {recommendations.items.map((item, index) => (
                  <article
                    key={`${item.name}-${item.country}-${item.region}`}
                    className={`chat-screen__recommendation-card${
                      index === activeRecommendationIndex
                        ? " chat-screen__recommendation-card--active"
                        : ""
                    }`}
                    ref={(element) => {
                      recommendationCardRefs.current[index] = element;
                    }}
                  >
                    <h2 className="chat-screen__recommendation-name">{item.name}</h2>
                    <p className="chat-screen__recommendation-origin">
                      {item.country} {"\u00b7"} {item.region}
                    </p>
                    <div className="chat-screen__recommendation-sensory-grid">
                      <section className="chat-screen__recommendation-sensory-block">
                        <span className="chat-screen__recommendation-label">Geur</span>
                        <p>{item.aromaDescription}</p>
                      </section>
                      <section className="chat-screen__recommendation-sensory-block">
                        <span className="chat-screen__recommendation-label">Smaak</span>
                        <p>{item.tasteDescription}</p>
                      </section>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chat-screen__action-rail">
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
              ref={inputRef}
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
      </div>
    </section>
  );
}
