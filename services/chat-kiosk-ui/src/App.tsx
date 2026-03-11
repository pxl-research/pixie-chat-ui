import type { CSSProperties } from "react";

import { ChatScreen } from "./components/ChatScreen";
import { CompletedScreen } from "./components/CompletedScreen";
import { ErrorScreen } from "./components/ErrorScreen";
import { StartScreen } from "./components/StartScreen";
import { readKioskCopyConfig } from "./config";
import { useKioskSession } from "./hooks/useKioskSession";

export default function App() {
  const session = useKioskSession();
  const copy = readKioskCopyConfig();
  const shellPhase =
    session.phase === "chatting"
      ? "chat"
      : session.phase === "start"
        ? "start"
        : "status";

  let content;
  switch (session.phase) {
    case "chatting":
      content = (
        <ChatScreen
          brandLabel={copy.brandLabel}
          logoUrl={copy.logoNoTextUrl || copy.logoUrl}
          title={copy.chatHeaderTitle}
          messages={session.messages}
          quickReplies={session.quickReplies}
          loading={session.loading}
          onRestart={session.resetConversation}
          onSendMessage={session.sendUserMessage}
        />
      );
      break;
    case "completed":
      content = (
        <CompletedScreen
          brandLabel={copy.brandLabel}
          onRestart={session.resetConversation}
        />
      );
      break;
    case "error":
      content = (
        <ErrorScreen
          brandLabel={copy.brandLabel}
          error={session.error ?? "De kioskservice is tijdelijk onbereikbaar."}
          onRetry={session.resetConversation}
        />
      );
      break;
    default:
      content = (
        <StartScreen
          brandLabel={copy.brandLabel}
          logoUrl={copy.logoUrl}
          title={copy.welcomeTitle}
          body={copy.welcomeBody}
          startLabel={copy.startLabel}
          helpText={copy.helpText}
          onStart={session.startConversation}
        />
      );
  }

  const shellStyle = {
    "--kiosk-warm": copy.primaryColor,
    "--kiosk-background-image": `url(${copy.backgroundImageUrl})`,
  } as CSSProperties;

  return (
    <main className={`kiosk-shell kiosk-shell--${shellPhase}`} style={shellStyle}>
      {content}
    </main>
  );
}
