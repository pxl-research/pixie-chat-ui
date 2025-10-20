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

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

const resolvedBaseUrl = configuredBaseUrl && configuredBaseUrl.length > 0
  ? configuredBaseUrl
  : (typeof window !== "undefined" ? window.location.origin : undefined);

if (!resolvedBaseUrl) {
  throw new Error("VITE_API_BASE_URL is not set and window.location is unavailable to derive the chat proxy URL.");
}

export const API_BASE_URL = resolvedBaseUrl.replace(/\/$/, "");

export async function fetchClientConfig(): Promise<ClientConfig> {
  const response = await fetch(`${API_BASE_URL}/client`);
  if (!response.ok) {
    throw new Error(`Failed to load client configuration: ${response.statusText}`);
  }
  return response.json();
}
