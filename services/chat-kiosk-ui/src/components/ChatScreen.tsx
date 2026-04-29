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
  followUpQuestion?: string | null;
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
  followUpQuestion,
  quickReplies,
  loading,
  onRestart,
  onSendMessage,
}: ChatScreenProps) {
  const [draft, setDraft] = useState("");
  const [activeRecommendationIndex, setActiveRecommendationIndex] = useState(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const followUpQuestionRef = useRef<HTMLElement>(null);
  const recommendationRailRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recommendationCardRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const scrollFrame = window.requestAnimationFrame(() => {
      const messagesContainer = messagesContainerRef.current;
      if (messagesContainer && typeof messagesContainer.scrollTo === "function") {
        messagesContainer.scrollTo({
          top: messagesContainer.scrollHeight,
          behavior: "smooth",
        });
      }

      if (followUpQuestionRef.current) {
        followUpQuestionRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    });

    return () => {
      window.cancelAnimationFrame(scrollFrame);
    };
  }, [messages, loading, recommendations, followUpQuestion]);

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

    const rail = recommendationRailRef.current;
    const activeCard = recommendationCardRefs.current[activeRecommendationIndex];
    if (!rail || !activeCard || typeof rail.scrollTo !== "function") {
      return;
    }

    rail.scrollTo({
      left: activeCard.offsetLeft,
      behavior: "smooth",
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
        <div ref={messagesContainerRef} className="chat-screen__messages" role="log" aria-live="polite">
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
          {loading ? (
            <article className="chat-screen__message chat-screen__message--assistant chat-screen__message--typing">
              <span className="chat-screen__role">{title}</span>
              <div
                className="chat-screen__typing-indicator"
                aria-label={`${title} is aan het typen`}
                role="status"
              >
                <span className="chat-screen__typing-dot" />
                <span className="chat-screen__typing-dot" />
                <span className="chat-screen__typing-dot" />
              </div>
            </article>
          ) : null}
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
              <div ref={recommendationRailRef} className="chat-screen__recommendation-rail">
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
          {followUpQuestion ? (
            <article
              ref={followUpQuestionRef}
              className="chat-screen__message chat-screen__message--assistant chat-screen__message--follow-up"
            >
              <span className="chat-screen__role">{title}</span>
              <p>{followUpQuestion}</p>
            </article>
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
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={loading}
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
