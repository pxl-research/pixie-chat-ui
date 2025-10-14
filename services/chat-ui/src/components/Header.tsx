import type { ClientTheme } from "../config/client";

type HeaderProps = {
  displayName: string;
  theme: ClientTheme;
  onNewConversation?: () => void;
  disableActions?: boolean;
};

export function Header({ displayName, theme, onNewConversation, disableActions = false }: HeaderProps) {
  const background = theme.primaryColor || "#1f2937";
  const logoUrl = theme.logoUrl;

  return (
    <header
      style={{
        backgroundColor: background,
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${displayName} logo`}
            style={{
              width: "40px",
              height: "40px",
              objectFit: "contain",
            }}
          />
        ) : null}
        <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>{displayName}</span>
      </div>
      {onNewConversation ? (
        <button
          type="button"
          onClick={onNewConversation}
          disabled={disableActions}
          style={{
            backgroundColor: "#ffffff",
            color: background,
            border: "none",
            borderRadius: "9999px",
            padding: "0.5rem 1rem",
            fontWeight: 600,
            cursor: disableActions ? "not-allowed" : "pointer",
            opacity: disableActions ? 0.7 : 1,
            transition: "opacity 0.2s ease",
          }}
        >
          Nieuwe conversatie
        </button>
      ) : null}
    </header>
  );
}
