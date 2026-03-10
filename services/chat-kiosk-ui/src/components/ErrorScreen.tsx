type ErrorScreenProps = {
  error: string;
  onRetry: () => void;
};

export function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  return (
    <section className="kiosk-screen kiosk-screen--status">
      <p className="kiosk-screen__eyebrow">Cretskens</p>
      <h1 className="kiosk-screen__title">Tijdelijk niet beschikbaar</h1>
      <p className="kiosk-screen__body">{error}</p>
      <button type="button" className="kiosk-primary-button" onClick={onRetry}>
        Opnieuw proberen
      </button>
    </section>
  );
}
