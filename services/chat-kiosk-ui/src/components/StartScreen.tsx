type StartScreenProps = {
  brandLabel: string;
  logoUrl?: string;
  title: string;
  body: string;
  startLabel: string;
  helpText: string;
  onStart: () => void;
};

export function StartScreen({
  brandLabel,
  logoUrl,
  title,
  body,
  startLabel,
  helpText,
  onStart,
}: StartScreenProps) {
  return (
    <section className="kiosk-screen kiosk-screen--start">
      <div className="kiosk-screen__hero">
        {logoUrl ? (
          <img className="kiosk-screen__logo" src={logoUrl} alt={brandLabel} />
        ) : null}
        <p className="kiosk-screen__eyebrow">{brandLabel}</p>
        <h1 className="kiosk-screen__title">{title}</h1>
        <p className="kiosk-screen__body">{body}</p>
      </div>
      <div className="kiosk-screen__footer">
        <p className="kiosk-screen__hint">{helpText}</p>
        <button type="button" className="kiosk-primary-button" onClick={onStart}>
          {startLabel}
        </button>
      </div>
    </section>
  );
}
