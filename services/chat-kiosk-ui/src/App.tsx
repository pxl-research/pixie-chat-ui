import { useKioskSession } from "./hooks/useKioskSession";

export default function App() {
  const session = useKioskSession();

  if (session.phase !== "start") {
    return (
      <main className="kiosk-shell">
        <section className="kiosk-start">
          <p className="kiosk-start__eyebrow">Cretskens</p>
          <h1 className="kiosk-start__title">Gesprek actief</h1>
          <button type="button" className="kiosk-start__button" onClick={session.resetConversation}>
            Opnieuw starten
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="kiosk-shell">
      <section className="kiosk-start">
        <p className="kiosk-start__eyebrow">Cretskens</p>
        <h1 className="kiosk-start__title">Cretskens Assistent</h1>
        <button type="button" className="kiosk-start__button" onClick={session.startConversation}>
          Start gesprek
        </button>
      </section>
    </main>
  );
}
