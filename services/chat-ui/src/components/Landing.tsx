import type { ClientConfig, LandingPreset } from "../config/client";

type LandingProps = {
  client: ClientConfig;
  onStart: (prefill?: string) => void | Promise<void>;
  loading?: boolean;
};

function renderPresets(presets: LandingPreset[], onStart: LandingProps["onStart"], loading: boolean) {
  if (presets.length === 0) {
    return null;
  }

  return (
    <div className="landing__preset-group" aria-label="Snelle startopties">
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          className="landing__preset"
          onClick={() => onStart(preset.prefill)}
          disabled={loading}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

export function Landing({ client, onStart, loading = false }: LandingProps) {
  const { landing, displayName } = client;
  const hasPresets = landing.presets.length > 0;

  return (
    <section className="landing">
      <div className="landing__panel">
        <p className="landing__eyebrow">{displayName}</p>
        <h1 className="landing__title">{landing.title}</h1>
        <div className="landing__notes">
          <div className="landing__note">
            <p>{landing.researchNote}</p>
          </div>
          <div className="landing__note">
            <p>{landing.privacyNote}</p>
          </div>
        </div>
        <div className="landing__actions">
          <button
            type="button"
            className="landing__start"
            onClick={() => onStart()}
            disabled={loading}
          >
            {landing.startLabel || "Start assistent"}
          </button>
          {hasPresets ? (
            <div className="landing__presets-wrapper">
              <span className="landing__hint">Of kies een snelle start:</span>
              {renderPresets(landing.presets, onStart, Boolean(loading))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
