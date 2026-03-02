import type { ClientTheme } from "../config/client";

type HeaderProps = {
  displayName: string;
  theme: ClientTheme;
  onNewConversation?: () => void;
  disableActions?: boolean;
  debugToggleEnabled?: boolean;
  debugModeEnabled?: boolean;
  onDebugModeChange?: (enabled: boolean) => void;
};

export function Header({
  displayName,
  theme,
  onNewConversation,
  disableActions = false,
  debugToggleEnabled = false,
  debugModeEnabled = false,
  onDebugModeChange,
}: HeaderProps) {
  const logoUrl = theme.logoUrl;
  const showActions = Boolean(onNewConversation) || debugToggleEnabled;

  return (
    <header className="app-header">
      <div className="app-header__left">
        {logoUrl ? (
          <img src={logoUrl} alt={`${displayName} logo`} className="app-header__logo" />
        ) : (
          <span className="app-header__title">{displayName}</span>
        )}
      </div>
      {showActions ? (
        <div className="app-header__actions">
          {debugToggleEnabled ? (
            <label className="app-header__debug-toggle">
              <input
                type="checkbox"
                checked={debugModeEnabled}
                disabled={disableActions}
                onChange={(event) => onDebugModeChange?.(event.target.checked)}
              />
              <span>Debug</span>
            </label>
          ) : null}
          {onNewConversation ? (
            <button
              type="button"
              onClick={onNewConversation}
              disabled={disableActions}
              className="app-header__action"
              aria-disabled={disableActions}
            >
              Nieuwe conversatie
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
