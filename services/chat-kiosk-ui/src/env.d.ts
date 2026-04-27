/// <reference types="vite/client" />

interface RuntimeEnv {
  QUESTIONER_API_BASE_URL?: string;
  PIXIE_QUESTIONER_CASE_ID?: string;
  KIOSK_IDLE_TIMEOUT_MS?: string;
  KIOSK_RESET_DELAY_MS?: string;
  ACTIVE_CLIENT_DISPLAY_NAME?: string;
  ACTIVE_CLIENT_PRIMARY_COLOR?: string;
  ACTIVE_CLIENT_LOGO_URL?: string;
  ACTIVE_CLIENT_LOGO_NO_TEXT_URL?: string;
  ACTIVE_CLIENT_BACKGROUND_IMAGE_URL?: string;
  ACTIVE_CLIENT_WELCOME_MESSAGE?: string;
  ACTIVE_CLIENT_CHAT_HEADER_TITLE?: string;
  ACTIVE_CLIENT_SECONDARY_LOGO_URL?: string;
  KIOSK_START_LABEL?: string;
  KIOSK_HELP_TEXT?: string;
  KIOSK_DISCLAIMER_TEXT?: string;
  KIOSK_SCREENSAVER_VIDEO_URL?: string;
  KIOSK_SCREENSAVER_DELAY_MS?: string;
}

interface Window {
  __ENV__?: RuntimeEnv;
}

interface ImportMetaEnv {
  readonly VITE_QUESTIONER_API_BASE_URL?: string;
  readonly VITE_QUESTIONER_CASE_ID?: string;
  readonly VITE_KIOSK_IDLE_TIMEOUT_MS?: string;
  readonly VITE_KIOSK_RESET_DELAY_MS?: string;
  readonly VITE_ACTIVE_CLIENT_DISPLAY_NAME?: string;
  readonly VITE_ACTIVE_CLIENT_PRIMARY_COLOR?: string;
  readonly VITE_ACTIVE_CLIENT_LOGO_URL?: string;
  readonly VITE_ACTIVE_CLIENT_LOGO_NO_TEXT_URL?: string;
  readonly VITE_ACTIVE_CLIENT_BACKGROUND_IMAGE_URL?: string;
  readonly VITE_ACTIVE_CLIENT_WELCOME_MESSAGE?: string;
  readonly VITE_ACTIVE_CLIENT_CHAT_HEADER_TITLE?: string;
  readonly VITE_ACTIVE_CLIENT_SECONDARY_LOGO_URL?: string;
  readonly VITE_KIOSK_START_LABEL?: string;
  readonly VITE_KIOSK_HELP_TEXT?: string;
  readonly VITE_KIOSK_DISCLAIMER_TEXT?: string;
  readonly VITE_KIOSK_SCREENSAVER_VIDEO_URL?: string;
  readonly VITE_KIOSK_SCREENSAVER_DELAY_MS?: string;
}
