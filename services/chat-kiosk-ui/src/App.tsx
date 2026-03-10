import { ChatScreen } from "./components/ChatScreen";
import { CompletedScreen } from "./components/CompletedScreen";
import { ErrorScreen } from "./components/ErrorScreen";
import { StartScreen } from "./components/StartScreen";
import { useKioskSession } from "./hooks/useKioskSession";

export default function App() {
  const session = useKioskSession();

  let content;
  switch (session.phase) {
    case "chatting":
      content = (
        <ChatScreen
          title="Cretskens Assistent"
          messages={session.messages}
          quickReplies={session.quickReplies}
          loading={session.loading}
          onRestart={session.resetConversation}
          onSendMessage={session.sendUserMessage}
        />
      );
      break;
    case "completed":
      content = <CompletedScreen onRestart={session.resetConversation} />;
      break;
    case "error":
      content = (
        <ErrorScreen
          error={session.error ?? "De kioskservice is tijdelijk onbereikbaar."}
          onRetry={session.resetConversation}
        />
      );
      break;
    default:
      content = <StartScreen onStart={session.startConversation} />;
  }

  return (
    <main className="kiosk-shell">
      {content}
    </main>
  );
}
