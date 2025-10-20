export type ClientTheme = {
  primaryColor?: string;
  logoUrl?: string;
  backgroundImageUrl?: string;
};

export type ClientConfig = {
  id: string;
  displayName: string;
  theme: ClientTheme;
  welcomeMessage?: string;
};

// Resolve API base URL (preferences):
// 1. Runtime configuration written to window.__ENV__.API_BASE_URL (recommended)
// 2. Vite build-time variable VITE_API_BASE_URL (optional)
// 3. Fallback to window.location.origin for co-hosted deployments
function getRuntimeBaseUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const runtime = window.__ENV__?.API_BASE_URL;
  return typeof runtime === "string" && runtime.trim().length > 0 ? runtime.trim() : undefined;
}

function getConfiguredBaseUrl(): string | undefined {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined) || undefined;
  return configured && configured.trim().length > 0 ? configured.trim() : undefined;
}

const resolvedBaseUrl = getRuntimeBaseUrl() ?? getConfiguredBaseUrl() ?? (typeof window !== "undefined" ? window.location.origin : undefined);

if (!resolvedBaseUrl) {
  throw new Error(
    "Unable to determine chat proxy URL. Provide window.__ENV__.API_BASE_URL or set VITE_API_BASE_URL at build time."
  );
}

export const API_BASE_URL = resolvedBaseUrl.replace(/\/$/, "");

export async function fetchClientConfig(): Promise<ClientConfig> {
  const response = await fetch(`${API_BASE_URL}/client`);
  if (!response.ok) {
    throw new Error(`Failed to load client configuration: ${response.statusText}`);
  }
  return response.json();
}
