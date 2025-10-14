import type { ClientTheme } from "../config/client";

type HeaderProps = {
  displayName: string;
  theme: ClientTheme;
};

export function Header({ displayName, theme }: HeaderProps) {
  const background = theme.primaryColor || "#1f2937";
  const logoUrl = theme.logoUrl;

  return (
    <header
      style={{
        backgroundColor: background,
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        padding: "0.75rem 1rem",
        gap: "0.75rem",
      }}
    >
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
    </header>
  );
}
