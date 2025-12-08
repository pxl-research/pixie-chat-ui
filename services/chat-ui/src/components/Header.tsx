import type { ClientTheme } from "../config/client";

type HeaderProps = {
  displayName: string;
  theme: ClientTheme;
  onNewConversation?: () => void;
  disableActions?: boolean;
};

export function Header({ displayName, theme, onNewConversation, disableActions = false }: HeaderProps) {
  const logoUrl = theme.logoUrl;

  return (
    <header className="app-header">
      <div className="app-header__left">
        {logoUrl ? (
          <img src={logoUrl} alt={`${displayName} logo`} className="app-header__logo" />
        ) : (
          <span className="app-header__title">{displayName}</span>
        )}
      </div>
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
    </header>
  );
}
