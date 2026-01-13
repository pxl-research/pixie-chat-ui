import { useCallback, useEffect, useState } from "react";

import "./App.css";

import { ChatWindow } from "./components/ChatWindow";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { type ClientConfig, fetchClientConfig } from "./config/client";
import { useChat } from "./hooks/useChat";
import { resolveOnPrimaryColor, resolvePrimaryColor } from "./utils/theme";

function App() {
  const [client, setClient] = useState<ClientConfig | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);
  const [hasEnteredChat, setHasEnteredChat] = useState(false);

  const { messages, loading, error, sendMessage, reset } = useChat(client?.welcomeMessage);
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    async function loadClient() {
      try {
        const config = await fetchClientConfig();
        setClient(config);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        setClientError(message);
      } finally {
        setLoadingClient(false);
      }
    }

    loadClient();
  }, []);

  const handleNewConversation = useCallback(() => {
    reset(client?.welcomeMessage);
    setSessionKey((prev) => prev + 1);
  }, [client?.welcomeMessage, reset]);

  const handleStart = useCallback(
    async (prefill?: string) => {
      handleNewConversation();
      setHasEnteredChat(true);
      if (prefill) {
        await sendMessage(prefill);
      }
    },
    [handleNewConversation, sendMessage],
  );

  if (loadingClient) {
    return <div className="app app-centered">Loading chat experience...</div>;
  }

  if (clientError || !client) {
    return (
      <div className="app app-centered">
        Unable to load client configuration.
        {clientError ? <p className="error">{clientError}</p> : null}
      </div>
    );
  }

  const backgroundImage = client.theme.backgroundImageUrl;
  const backgroundStyle = backgroundImage
    ? {
        backgroundImage: `linear-gradient(rgba(249,250,251,0.65), rgba(249,250,251,0.65)), url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : {};

  const primaryColor = resolvePrimaryColor(client.theme);
  const onPrimaryColor = resolveOnPrimaryColor(primaryColor);
  const themeStyle: React.CSSProperties = {
    ...(primaryColor ? { ["--primary-color"]: primaryColor } : {}),
    ...(onPrimaryColor ? { ["--on-primary"]: onPrimaryColor } : {}),
  };
  const chatHeaderTitle =
    client.chatHeader?.title?.trim() || `${client.displayName} Assistant`;
  const chatHeaderLogoUrl = client.chatHeader?.logoUrl?.trim() || client.theme.logoUrl;

  return (
    <div className="app" style={{ ...backgroundStyle, ...themeStyle }}>
      <Header
        displayName={client.displayName}
        theme={client.theme}
        onNewConversation={hasEnteredChat ? handleNewConversation : undefined}
        disableActions={loading}
      />
      <main>
        {hasEnteredChat ? (
          <ChatWindow
            key={sessionKey}
            messages={messages}
            headerTitle={chatHeaderTitle}
            headerLogoUrl={chatHeaderLogoUrl}
            onSend={sendMessage}
            loading={loading}
            error={error}
          />
        ) : (
          <Landing
            client={client}
            onStart={handleStart}
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}

export default App;
