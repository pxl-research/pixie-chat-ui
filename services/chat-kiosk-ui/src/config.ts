export type KioskConfig = {
  questionerBaseUrl: string;
  caseId: string;
  idleTimeoutMs: number;
  resetDelayMs: number;
};

export type KioskCopyConfig = {
  displayName: string;
  primaryColor: string;
  logoUrl: string;
  logoNoTextUrl: string;
  backgroundImageUrl: string;
  chatHeaderTitle: string;
  welcomeMessage: string;
  brandLabel: string;
  welcomeTitle: string;
  welcomeBody: string;
  startLabel: string;
  helpText: string;
};

const DEFAULT_IDLE_TIMEOUT_MS = 90_000;
const DEFAULT_RESET_DELAY_MS = 10_000;
const DEFAULT_KIOSK_COPY: KioskCopyConfig = {
  displayName: "CRETSKENS",
  primaryColor: "#6A1E2C",
  logoUrl: "/branding/cretskens/logo.png",
  logoNoTextUrl: "/branding/cretskens/logo_no_text.png",
  backgroundImageUrl: "/branding/cretskens/background.png",
  chatHeaderTitle: "Cretskens Wijnassistent",
  welcomeMessage:
    "Hallo, ik ben je Cretskens AI-assistent. Ik help je graag om de juiste wijn bij je gerecht te vinden. Vertel me wat je gaat eten, dan maak ik een duidelijke samenvatting voor gericht advies in de winkel.",
  brandLabel: "CRETSKENS",
  welcomeTitle: "Cretskens Wijnassistent",
  welcomeBody:
    "Hallo, ik ben je Cretskens AI-assistent. Ik help je graag om de juiste wijn bij je gerecht te vinden. Vertel me wat je gaat eten, dan maak ik een duidelijke samenvatting voor gericht advies in de winkel.",
  startLabel: "Start gesprek",
  helpText: "Tik op start en laat je stap voor stap begeleiden.",
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

function readOptionalTextEnv(name: keyof ImportMetaEnv, fallback: string): string {
  const rawValue = import.meta.env[name];
  if (!rawValue || !rawValue.trim()) {
    return fallback;
  }

  return rawValue.trim();
}

export function readKioskConfig(): KioskConfig {
  return {
    questionerBaseUrl: readRequiredEnv("VITE_QUESTIONER_API_BASE_URL").replace(/\/$/, ""),
    caseId: readRequiredEnv("VITE_QUESTIONER_CASE_ID"),
    idleTimeoutMs: readNumberEnv("VITE_KIOSK_IDLE_TIMEOUT_MS", DEFAULT_IDLE_TIMEOUT_MS),
    resetDelayMs: readNumberEnv("VITE_KIOSK_RESET_DELAY_MS", DEFAULT_RESET_DELAY_MS),
  };
}

export function readKioskTimingConfig(): Pick<KioskConfig, "idleTimeoutMs" | "resetDelayMs"> {
  return {
    idleTimeoutMs: readNumberEnv("VITE_KIOSK_IDLE_TIMEOUT_MS", DEFAULT_IDLE_TIMEOUT_MS),
    resetDelayMs: readNumberEnv("VITE_KIOSK_RESET_DELAY_MS", DEFAULT_RESET_DELAY_MS),
  };
}

export function readKioskCopyConfig(): KioskCopyConfig {
  const displayName = readOptionalTextEnv(
    "VITE_ACTIVE_CLIENT_DISPLAY_NAME",
    DEFAULT_KIOSK_COPY.displayName,
  );
  const primaryColor = readOptionalTextEnv(
    "VITE_ACTIVE_CLIENT_PRIMARY_COLOR",
    DEFAULT_KIOSK_COPY.primaryColor,
  );
  const logoUrl = readOptionalTextEnv("VITE_ACTIVE_CLIENT_LOGO_URL", DEFAULT_KIOSK_COPY.logoUrl);
  const logoNoTextUrl = readOptionalTextEnv(
    "VITE_ACTIVE_CLIENT_LOGO_NO_TEXT_URL",
    DEFAULT_KIOSK_COPY.logoNoTextUrl,
  );
  const backgroundImageUrl = readOptionalTextEnv(
    "VITE_ACTIVE_CLIENT_BACKGROUND_IMAGE_URL",
    DEFAULT_KIOSK_COPY.backgroundImageUrl,
  );
  const chatHeaderTitle = readOptionalTextEnv(
    "VITE_ACTIVE_CLIENT_CHAT_HEADER_TITLE",
    DEFAULT_KIOSK_COPY.chatHeaderTitle,
  );
  const welcomeMessage = readOptionalTextEnv(
    "VITE_ACTIVE_CLIENT_WELCOME_MESSAGE",
    DEFAULT_KIOSK_COPY.welcomeMessage,
  );
  const startLabel = readOptionalTextEnv("VITE_KIOSK_START_LABEL", DEFAULT_KIOSK_COPY.startLabel);
  const helpText = readOptionalTextEnv("VITE_KIOSK_HELP_TEXT", DEFAULT_KIOSK_COPY.helpText);

  return {
    displayName,
    primaryColor,
    logoUrl,
    logoNoTextUrl,
    backgroundImageUrl,
    chatHeaderTitle,
    welcomeMessage,
    brandLabel: displayName,
    welcomeTitle: chatHeaderTitle,
    welcomeBody: welcomeMessage,
    startLabel,
    helpText,
  };
}
