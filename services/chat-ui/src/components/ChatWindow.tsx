import { useState } from "react";

import type { FormEvent } from "react";

import type { ClientTheme } from "../config/client";
import type { ChatMessage } from "../hooks/useChat";
import { SearchResultsCarousel } from "./SearchResultsCarousel";

type ChatWindowProps = {
  messages: ChatMessage[];
  onSend: (content: string) => Promise<void> | void;
  loading: boolean;
  error: string | null;
  theme: ClientTheme;
};

export function ChatWindow({ messages, onSend, loading, error, theme }: ChatWindowProps) {
  const [draft, setDraft] = useState("");

  const primaryColor = theme.primaryColor || "#1f2937";

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
          messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`message ${message.role}`}>
              <span className="role">{message.role === "user" ? "You" : "Pixie"}</span>
              <p>{message.content}</p>
              {message.rich?.type === "search-results" ? (
                <SearchResultsCarousel results={message.rich.results} />
              ) : null}
            </div>
          ))
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
        <button type="submit" disabled={loading || draft.trim().length === 0} style={{ backgroundColor: primaryColor }}>
          {loading ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
