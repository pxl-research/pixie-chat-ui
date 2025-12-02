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

const DEFAULT_API_BASE_URL = "http://localhost:8010";

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("DEFAULT_API_BASE_URL must not be empty.");
  }
  return trimmed.replace(/\/$/, "");
}

export const API_BASE_URL = normalizeBaseUrl(DEFAULT_API_BASE_URL);

export async function fetchClientConfig(): Promise<ClientConfig> {
  const response = await fetch(`${API_BASE_URL}/client`);
  if (!response.ok) {
    throw new Error(`Failed to load client configuration: ${response.statusText}`);
  }
  return response.json();
}
