import { useCallback, useEffect, useState } from "react";

import "./App.css";

import { ChatWindow } from "./components/ChatWindow";
import { Header } from "./components/Header";
import { type ClientConfig, fetchClientConfig } from "./config/client";
import { useChat } from "./hooks/useChat";

function App() {
  const [client, setClient] = useState<ClientConfig | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);

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
  const appStyle = backgroundImage
    ? {
        backgroundImage: `linear-gradient(rgba(249,250,251,0.65), rgba(249,250,251,0.65)), url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : undefined;

  return (
    <div className="app" style={appStyle}>
      <Header displayName={client.displayName} theme={client.theme} onNewConversation={handleNewConversation} disableActions={loading} />
      <main>
        <ChatWindow
          key={sessionKey}
          messages={messages}
          onSend={sendMessage}
          loading={loading}
          error={error}
          theme={client.theme}
        />
      </main>
    </div>
  );
}

export default App;
