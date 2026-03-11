type ErrorScreenProps = {
  brandLabel?: string;
  error: string;
  onRetry: () => void;
};

export function ErrorScreen({
  brandLabel = "CRETSKENS",
  error,
  onRetry,
}: ErrorScreenProps) {
  return (
    <section className="kiosk-screen kiosk-screen--status">
      <div className="kiosk-screen__hero">
        <p className="kiosk-screen__eyebrow">{brandLabel}</p>
        <h1 className="kiosk-screen__title">Tijdelijk niet beschikbaar</h1>
        <p className="kiosk-screen__body">{error}</p>
      </div>
      <div className="kiosk-screen__footer">
        <p className="kiosk-screen__hint">Controleer de verbinding en probeer opnieuw.</p>
        <button type="button" className="kiosk-primary-button" onClick={onRetry}>
          Opnieuw proberen
        </button>
      </div>
    </section>
  );
}
