import type { ClientTheme } from "../config/client";

export function resolvePrimaryColor(theme: ClientTheme): string | undefined {
  const candidate = theme.primaryColor?.trim();
  if (!candidate) return undefined;

  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return candidate;
  }

  return CSS.supports("color", candidate) ? candidate : undefined;
}
