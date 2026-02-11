import { useCallback, useEffect, useMemo, useState } from "react";

import "./App.css";

import { ChatWindow } from "./components/ChatWindow";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { type ClientConfig, fetchClientConfig } from "./config/client";
import { useChat } from "./hooks/useChat";
import { resolveOnPrimaryColor, resolvePrimaryColor } from "./utils/theme";
import { buildStickyConversationState, resolveCustomerLocation } from "./utils/urlContext";

type InvalidLocationState = {
  location: string;
  allowedLocations: string[];
};

function App() {
  const locationFromUrl = useMemo(
    () =>
      resolveCustomerLocation(
        typeof window !== "undefined" ? window.location.search : "",
      ),
    [],
  );
  const stickyConversationState = useMemo(
    () =>
      buildStickyConversationState(
        typeof window !== "undefined" ? window.location.search : "",
      ),
    [],
  );
  const [client, setClient] = useState<ClientConfig | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);
  const [invalidLocation, setInvalidLocation] = useState<InvalidLocationState | null>(null);
  const [hasEnteredChat, setHasEnteredChat] = useState(false);

  const { messages, loading, error, sendMessage, reset, isComplete } = useChat(
    client?.welcomeMessage,
    stickyConversationState,
  );
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    async function loadClient() {
      try {
        const config = await fetchClientConfig();
        setClient(config);
        if (locationFromUrl && Array.isArray(config.allowedLocations) && config.allowedLocations.length > 0) {
          const normalizedAllowedLocations = config.allowedLocations
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0);
          if (normalizedAllowedLocations.length > 0) {
            const isAllowed = normalizedAllowedLocations.some(
              (allowedLocation) => allowedLocation.toLowerCase() === locationFromUrl.toLowerCase(),
            );
            if (!isAllowed) {
              setInvalidLocation({
                location: locationFromUrl,
                allowedLocations: normalizedAllowedLocations,
              });
              return;
            }
          }
        }
        setInvalidLocation(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        setClientError(message);
      } finally {
        setLoadingClient(false);
      }
    }

    loadClient();
  }, [locationFromUrl]);

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
  const themeStyle = {
    ...(primaryColor ? { ["--primary-color"]: primaryColor } : {}),
    ...(onPrimaryColor ? { ["--on-primary"]: onPrimaryColor } : {}),
  } as React.CSSProperties;
  const chatHeaderTitle =
    client.chatHeader?.title?.trim() || `${client.displayName} Assistant`;
  const chatHeaderLogoUrl = client.chatHeader?.logoUrl?.trim() || client.theme.logoUrl;

  const appClassName = `app ${hasEnteredChat ? "app--chat" : "app--landing"}`;

  if (invalidLocation) {
    return (
      <div className={appClassName} style={{ ...backgroundStyle, ...themeStyle }}>
        <Header
          displayName={client.displayName}
          theme={client.theme}
          disableActions
        />
        <main>
          <section className="landing" aria-live="polite">
            <div className="landing__panel">
              <p className="landing__eyebrow">Ongeldige Locatie</p>
              <h1 className="landing__title">Deze link bevat een ongeldige locatie.</h1>
              <div className="landing__notes">
                <div className="landing__note">
                  <p>
                    Locatie in de URL: <strong>{invalidLocation.location}</strong>
                  </p>
                </div>
                <div className="landing__note">
                  <p>Toegelaten locaties: {invalidLocation.allowedLocations.join(", ")}</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={appClassName} style={{ ...backgroundStyle, ...themeStyle }}>
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
            isComplete={isComplete}
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
