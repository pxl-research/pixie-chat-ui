export type ClientTheme = {
  primaryColor?: string;
  logoUrl?: string;
};

export type ClientConfig = {
  id: string;
  displayName: string;
  theme: ClientTheme;
};

const DEFAULT_API_BASE_URL = "http://localhost:8010";

const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  DEFAULT_API_BASE_URL;

export const API_BASE_URL = apiBaseUrl;

export async function fetchClientConfig(): Promise<ClientConfig> {
  const response = await fetch(`${apiBaseUrl}/client`);
  if (!response.ok) {
    throw new Error(`Failed to load client configuration: ${response.statusText}`);
  }
  return response.json();
}
