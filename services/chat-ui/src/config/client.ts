export type ClientTheme = {
  primaryColor?: string;
  logoUrl?: string;
  backgroundImageUrl?: string;
};

export type ChatHeaderConfig = {
  title?: string;
  logoUrl?: string;
};

export type LandingPreset = {
  label: string;
  prefill: string;
};

export type LandingConfig = {
  title: string;
  researchNote: string;
  privacyNote: string;
  startLabel: string;
  presets: LandingPreset[];
};

export type ClientConfig = {
  id: string;
  displayName: string;
  theme: ClientTheme;
  chatHeader?: ChatHeaderConfig;
  welcomeMessage?: string;
  landing: LandingConfig;
};

const FALLBACK_API_BASE_URL = "/api";

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("DEFAULT_API_BASE_URL must not be empty.");
  }
  return trimmed.replace(/\/$/, "");
}

function resolveApiBaseUrl(): string {
  const runtimeBaseUrl =
    typeof window !== "undefined" ? window.__ENV__?.API_BASE_URL?.trim() : undefined;
  const viteBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  return normalizeBaseUrl(runtimeBaseUrl || viteBaseUrl || FALLBACK_API_BASE_URL);
}

export const API_BASE_URL = resolveApiBaseUrl();

export async function fetchClientConfig(): Promise<ClientConfig> {
  const response = await fetch(`${API_BASE_URL}/client`);
  if (!response.ok) {
    throw new Error(`Failed to load client configuration: ${response.statusText}`);
  }
  return response.json();
}
