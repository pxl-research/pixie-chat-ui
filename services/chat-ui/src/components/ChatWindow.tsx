import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { FormEvent } from "react";

import { ROLE_USER, SEARCH_RESULTS } from "../constants";
import type { ChatMessage, QuickReplyOption } from "../types";
import { SearchResultsCarousel } from "./SearchResultsCarousel";

type ChatWindowProps = {
  messages: ChatMessage[];
  headerTitle: string;
  headerLogoUrl?: string;
  onSend: (content: string) => Promise<void> | void;
  onQuickReplySelect: (value: string) => Promise<void> | void;
  quickReplies: QuickReplyOption[];
  loading: boolean;
  error: string | null;
  isComplete?: boolean;
};

export function ChatWindow({
  messages,
  headerTitle,
  headerLogoUrl,
  onSend,
  onQuickReplySelect,
  quickReplies,
  loading,
  error,
  isComplete = false,
}: ChatWindowProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  useEffect(() => {
    if (!autoScrollEnabled) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length, loading, autoScrollEnabled]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }
    const threshold = 24;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtBottom = distanceFromBottom <= threshold;
    setAutoScrollEnabled((prev) => (prev === isAtBottom ? prev : isAtBottom));
  };

  const handleScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setAutoScrollEnabled(true);
    inputRef.current?.focus();
  };

  const showScrollToBottom = !autoScrollEnabled && messages.length > 0;

  // theme primary color is applied at the app root as CSS variable --primary-color

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isComplete) {
      return;
    }
    const content = draft.trim();
    if (!content) {
      return;
    }
    setDraft("");
    await onSend(content);
  }

  return (
    <div className="chat-window">
      <header className="chat-header">
        {headerLogoUrl ? (
          <img src={headerLogoUrl} alt={`${headerTitle} logo`} className="chat-header__logo" />
        ) : null}
        <span className="chat-header__title">{headerTitle}</span>
      </header>
      <div className="messages-wrapper">
        <div
          className="messages"
          role="log"
          aria-live="polite"
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
        >
          {messages.length === 0 ? (
            <div className="empty-state">Start het gesprek door hallo te zeggen.</div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`message ${message.role}${message.variant ? ` ${message.variant}` : ""}`}
                >
                  <span className="role">
                    {message.role === ROLE_USER
                      ? "You"
                      : message.variant === "summary"
                        ? "Samenvatting"
                        : headerTitle}
                  </span>
                  {message.content ? (
                    <div className="message__markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : null}
                  {message.rich?.type === SEARCH_RESULTS ? (
                    <SearchResultsCarousel results={message.rich.results} />
                  ) : null}
                </div>
              ))}
              {loading ? (
                <div className="message assistant typing">
                  <span className="role">{headerTitle}</span>
                  <div
                    className="typing-indicator"
                    aria-label={`${headerTitle} is typing`}
                    role="status"
                  >
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : null}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
        {showScrollToBottom ? (
          <button type="button" className="scroll-to-bottom" onClick={handleScrollToBottom}>
            Naar beneden
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : null}

      {!isComplete && quickReplies.length > 0 ? (
        <div className="quick-replies" aria-label="Snelle antwoordopties">
          {quickReplies.map((reply) => (
            <button
              key={`${reply.value}-${reply.label}`}
              type="button"
              className="quick-replies__option"
              onClick={() => onQuickReplySelect(reply.value)}
              disabled={loading}
            >
              {reply.label}
            </button>
          ))}
        </div>
      ) : null}

      <form className="composer" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          autoFocus
          type="text"
          placeholder={
            isComplete
              ? "Gesprek afgerond."
              : loading
                ? "Wachten op antwoord..."
                : "Typ je bericht"
          }
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={loading || isComplete}
        />
        <button
          type="submit"
          className="composer__send"
          disabled={loading || isComplete || draft.trim().length === 0}
        >
          {loading ? "Verzenden..." : "Versturen"}
        </button>
      </form>
    </div>
  );
}
