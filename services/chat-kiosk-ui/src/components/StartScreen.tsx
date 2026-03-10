type StartScreenProps = {
  onStart: () => void;
};

export function StartScreen({ onStart }: StartScreenProps) {
  return (
    <section className="kiosk-screen kiosk-screen--start">
      <p className="kiosk-screen__eyebrow">Cretskens</p>
      <h1 className="kiosk-screen__title">Vraag advies op het grote scherm</h1>
      <p className="kiosk-screen__body">
        Start een nieuw gesprek en ontdek in enkele stappen welke suggesties het best bij je passen.
      </p>
      <button type="button" className="kiosk-primary-button" onClick={onStart}>
        Start gesprek
      </button>
    </section>
  );
}
