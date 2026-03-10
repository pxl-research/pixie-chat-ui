/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QUESTIONER_API_BASE_URL?: string;
  readonly VITE_QUESTIONER_CASE_ID?: string;
  readonly VITE_KIOSK_IDLE_TIMEOUT_MS?: string;
  readonly VITE_KIOSK_RESET_DELAY_MS?: string;
}
