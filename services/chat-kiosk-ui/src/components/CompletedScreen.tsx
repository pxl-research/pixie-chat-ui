type CompletedScreenProps = {
  brandLabel?: string;
  onRestart: () => void;
};

export function CompletedScreen({
  brandLabel = "CRETSKENS",
  onRestart,
}: CompletedScreenProps) {
  return (
    <section className="kiosk-screen kiosk-screen--status">
      <div className="kiosk-screen__hero">
        <p className="kiosk-screen__eyebrow">{brandLabel}</p>
        <h1 className="kiosk-screen__title">Bedankt voor je gesprek</h1>
        <p className="kiosk-screen__body">
          Het scherm keert automatisch terug naar het beginscherm. Je kunt ook meteen een nieuw gesprek starten.
        </p>
      </div>
      <div className="kiosk-screen__footer">
        <p className="kiosk-screen__hint">Nieuwe klanten kunnen meteen opnieuw beginnen.</p>
        <button type="button" className="kiosk-primary-button" onClick={onRestart}>
          Nieuw gesprek
        </button>
      </div>
    </section>
  );
}
