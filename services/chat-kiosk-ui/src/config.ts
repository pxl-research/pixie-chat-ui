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

type KioskRuntimeEnv = {
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
  KIOSK_START_LABEL?: string;
  KIOSK_HELP_TEXT?: string;
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

function readRuntimeEnv(name: keyof KioskRuntimeEnv): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const value = window.__ENV__?.[name];
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return value.trim();
}

function readBuildEnv(name: keyof ImportMetaEnv): string | undefined {
  const value = import.meta.env[name];
  if (!value || !value.trim()) {
    return undefined;
  }

  return value.trim();
}

function readRequiredConfig(runtimeName: keyof KioskRuntimeEnv, buildName: keyof ImportMetaEnv): string {
  const value = readRuntimeEnv(runtimeName) ?? readBuildEnv(buildName);
  if (!value) {
    throw new Error(`Missing required kiosk configuration: ${runtimeName} or ${buildName}`);
  }

  return value;
}

function readNumberConfig(
  runtimeName: keyof KioskRuntimeEnv,
  buildName: keyof ImportMetaEnv,
  fallback: number,
): number {
  const rawValue = readRuntimeEnv(runtimeName) ?? readBuildEnv(buildName);
  if (!rawValue || !rawValue.trim()) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function readOptionalTextConfig(
  runtimeName: keyof KioskRuntimeEnv,
  buildName: keyof ImportMetaEnv,
  fallback: string,
): string {
  return readRuntimeEnv(runtimeName) ?? readBuildEnv(buildName) ?? fallback;
}

export function readKioskConfig(): KioskConfig {
  return {
    questionerBaseUrl: readRequiredConfig(
      "QUESTIONER_API_BASE_URL",
      "VITE_QUESTIONER_API_BASE_URL",
    ).replace(/\/$/, ""),
    caseId: readRequiredConfig("PIXIE_QUESTIONER_CASE_ID", "VITE_QUESTIONER_CASE_ID"),
    idleTimeoutMs: readNumberConfig(
      "KIOSK_IDLE_TIMEOUT_MS",
      "VITE_KIOSK_IDLE_TIMEOUT_MS",
      DEFAULT_IDLE_TIMEOUT_MS,
    ),
    resetDelayMs: readNumberConfig(
      "KIOSK_RESET_DELAY_MS",
      "VITE_KIOSK_RESET_DELAY_MS",
      DEFAULT_RESET_DELAY_MS,
    ),
  };
}

export function readKioskTimingConfig(): Pick<KioskConfig, "idleTimeoutMs" | "resetDelayMs"> {
  return {
    idleTimeoutMs: readNumberConfig(
      "KIOSK_IDLE_TIMEOUT_MS",
      "VITE_KIOSK_IDLE_TIMEOUT_MS",
      DEFAULT_IDLE_TIMEOUT_MS,
    ),
    resetDelayMs: readNumberConfig(
      "KIOSK_RESET_DELAY_MS",
      "VITE_KIOSK_RESET_DELAY_MS",
      DEFAULT_RESET_DELAY_MS,
    ),
  };
}

export function readKioskCopyConfig(): KioskCopyConfig {
  const displayName = readOptionalTextConfig(
    "ACTIVE_CLIENT_DISPLAY_NAME",
    "VITE_ACTIVE_CLIENT_DISPLAY_NAME",
    DEFAULT_KIOSK_COPY.displayName,
  );
  const primaryColor = readOptionalTextConfig(
    "ACTIVE_CLIENT_PRIMARY_COLOR",
    "VITE_ACTIVE_CLIENT_PRIMARY_COLOR",
    DEFAULT_KIOSK_COPY.primaryColor,
  );
  const logoUrl = readOptionalTextConfig(
    "ACTIVE_CLIENT_LOGO_URL",
    "VITE_ACTIVE_CLIENT_LOGO_URL",
    DEFAULT_KIOSK_COPY.logoUrl,
  );
  const logoNoTextUrl = readOptionalTextConfig(
    "ACTIVE_CLIENT_LOGO_NO_TEXT_URL",
    "VITE_ACTIVE_CLIENT_LOGO_NO_TEXT_URL",
    DEFAULT_KIOSK_COPY.logoNoTextUrl,
  );
  const backgroundImageUrl = readOptionalTextConfig(
    "ACTIVE_CLIENT_BACKGROUND_IMAGE_URL",
    "VITE_ACTIVE_CLIENT_BACKGROUND_IMAGE_URL",
    DEFAULT_KIOSK_COPY.backgroundImageUrl,
  );
  const chatHeaderTitle = readOptionalTextConfig(
    "ACTIVE_CLIENT_CHAT_HEADER_TITLE",
    "VITE_ACTIVE_CLIENT_CHAT_HEADER_TITLE",
    DEFAULT_KIOSK_COPY.chatHeaderTitle,
  );
  const welcomeMessage = readOptionalTextConfig(
    "ACTIVE_CLIENT_WELCOME_MESSAGE",
    "VITE_ACTIVE_CLIENT_WELCOME_MESSAGE",
    DEFAULT_KIOSK_COPY.welcomeMessage,
  );
  const startLabel = readOptionalTextConfig(
    "KIOSK_START_LABEL",
    "VITE_KIOSK_START_LABEL",
    DEFAULT_KIOSK_COPY.startLabel,
  );
  const helpText = readOptionalTextConfig(
    "KIOSK_HELP_TEXT",
    "VITE_KIOSK_HELP_TEXT",
    DEFAULT_KIOSK_COPY.helpText,
  );

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
