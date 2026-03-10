export type KioskConfig = {
  questionerBaseUrl: string;
  caseId: string;
  idleTimeoutMs: number;
  resetDelayMs: number;
};

function readRequiredEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function readNumberEnv(name: keyof ImportMetaEnv, fallback: number): number {
  const rawValue = import.meta.env[name];
  if (!rawValue || !rawValue.trim()) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function readKioskConfig(): KioskConfig {
  return {
    questionerBaseUrl: readRequiredEnv("VITE_QUESTIONER_API_BASE_URL").replace(/\/$/, ""),
    caseId: readRequiredEnv("VITE_QUESTIONER_CASE_ID"),
    idleTimeoutMs: readNumberEnv("VITE_KIOSK_IDLE_TIMEOUT_MS", 90_000),
    resetDelayMs: readNumberEnv("VITE_KIOSK_RESET_DELAY_MS", 10_000),
  };
}
