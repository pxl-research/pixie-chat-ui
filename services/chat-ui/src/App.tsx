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
  reason: "missing" | "invalid";
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
  const [debugModeEnabled, setDebugModeEnabled] = useState(false);

  const {
    messages,
    loading,
    error,
    sendMessage,
    reset,
    isComplete,
    activeQuickReplies,
  } = useChat(
    client?.welcomeMessage,
    stickyConversationState,
    { debugModeEnabled },
  );
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    async function loadClient() {
      try {
        const config = await fetchClientConfig();
        setClient(config);
        setDebugModeEnabled(
          config.debug?.toggleEnabled === true && config.debug?.defaultEnabled === true,
        );

        const normalizedAllowedLocations = Array.isArray(config.allowedLocations)
          ? config.allowedLocations
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter((value) => value.length > 0)
          : [];

        if (normalizedAllowedLocations.length > 0) {
          if (!locationFromUrl) {
            setInvalidLocation({ reason: "missing" });
            return;
          }

          const isAllowed = normalizedAllowedLocations.some(
            (allowedLocation) => allowedLocation.toLowerCase() === locationFromUrl.toLowerCase(),
          );

          if (!isAllowed) {
            setInvalidLocation({ reason: "invalid" });
            return;
          }
        }

        setInvalidLocation(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Onverwachte fout";
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
    return <div className="app app-centered">Chatervaring laden...</div>;
  }

  if (clientError || !client) {
    return (
      <div className="app app-centered">
        Chatconfiguratie laden mislukt.
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
        <Header displayName={client.displayName} theme={client.theme} disableActions />
        <main>
          <section className="landing" aria-live="polite">
            <div className="landing__panel">
              <p className="landing__eyebrow">Ongeldige Locatie</p>
              <h1 className="landing__title">Deze chatlink is ongeldig.</h1>
              <div className="landing__notes">
                <div className="landing__note">
                  <p>
                    {invalidLocation.reason === "missing"
                      ? "De locatieparameter ontbreekt in de URL."
                      : "De locatieparameter in de URL is ongeldig."}
                  </p>
                </div>
                <div className="landing__note">
                  <p>Gebruik de originele link of vraag een geldige chatlink op.</p>
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
        debugToggleEnabled={hasEnteredChat && client.debug?.toggleEnabled === true}
        debugModeEnabled={debugModeEnabled}
        onDebugModeChange={setDebugModeEnabled}
      />
      <main>
        {hasEnteredChat ? (
          <ChatWindow
            key={sessionKey}
            messages={messages}
            headerTitle={chatHeaderTitle}
            headerLogoUrl={chatHeaderLogoUrl}
            onSend={sendMessage}
            onQuickReplySelect={sendMessage}
            quickReplies={activeQuickReplies}
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
