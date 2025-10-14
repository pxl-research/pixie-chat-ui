import { useEffect, useState } from "react";

import "./App.css";

import { ChatWindow } from "./components/ChatWindow";
import { Header } from "./components/Header";
import { type ClientConfig, fetchClientConfig } from "./config/client";
import { useChat } from "./hooks/useChat";

function App() {
  const [client, setClient] = useState<ClientConfig | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);

  const { messages, loading, error, sendMessage } = useChat();

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

  return (
    <div className="app">
      <Header displayName={client.displayName} theme={client.theme} />
      <main>
        <ChatWindow messages={messages} onSend={sendMessage} loading={loading} error={error} theme={client.theme} />
      </main>
    </div>
  );
}

export default App;
