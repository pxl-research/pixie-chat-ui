type CompletedScreenProps = {
  onRestart: () => void;
};

export function CompletedScreen({ onRestart }: CompletedScreenProps) {
  return (
    <section className="kiosk-screen kiosk-screen--status">
      <p className="kiosk-screen__eyebrow">Cretskens</p>
      <h1 className="kiosk-screen__title">Bedankt voor je gesprek</h1>
      <p className="kiosk-screen__body">
        Het scherm keert automatisch terug naar het beginscherm. Je kunt ook meteen een nieuw gesprek starten.
      </p>
      <button type="button" className="kiosk-primary-button" onClick={onRestart}>
        Nieuw gesprek
      </button>
    </section>
  );
}
