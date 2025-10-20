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

const runtimeBaseUrl =
  typeof window !== "undefined" ? window.__ENV__?.API_BASE_URL?.trim() : undefined;

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

const resolvedBaseUrl =
  (runtimeBaseUrl && runtimeBaseUrl.length > 0 && runtimeBaseUrl) ||
  (configuredBaseUrl && configuredBaseUrl.length > 0 && configuredBaseUrl) ||
  (typeof window !== "undefined" ? window.location.origin : undefined);

if (!resolvedBaseUrl) {
  throw new Error(
    "Unable to determine chat proxy URL. Set VITE_API_BASE_URL or expose window.__ENV.API_BASE_URL."
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
