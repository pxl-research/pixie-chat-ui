import { useState } from "react";

import type { FormEvent } from "react";

import type { ChatMessage } from "../types";
import { ROLE_USER, SEARCH_RESULTS } from "../constants";
import { SearchResultsCarousel } from "./SearchResultsCarousel";

type ChatWindowProps = {
  messages: ChatMessage[];
  onSend: (content: string) => Promise<void> | void;
  loading: boolean;
  error: string | null;
};

export function ChatWindow({ messages, onSend, loading, error }: ChatWindowProps) {
  const [draft, setDraft] = useState("");

  // theme primary color is applied at the app root as CSS variable --primary-color

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) {
      return;
    }
    setDraft("");
    await onSend(content);
  }

  return (
    <div className="chat-window">
      <div className="messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-state">Start the conversation by saying hello.</div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`message ${message.role}`}>
                <span className="role">{message.role === ROLE_USER ? "You" : "Pixie"}</span>
                {message.content ? <p>{message.content}</p> : null}
                {message.rich?.type === SEARCH_RESULTS ? (
                  <SearchResultsCarousel results={message.rich.results} />
                ) : null}
              </div>
            ))}
            {loading ? (
              <div className="message assistant typing">
                <span className="role">Pixie</span>
                <div className="typing-indicator" aria-label="Pixie is typing" role="status">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="composer" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={loading ? "Waiting for response..." : "Type your message"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={loading}
        />
        <button type="submit" className="composer__send" disabled={loading || draft.trim().length === 0}>
          {loading ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
