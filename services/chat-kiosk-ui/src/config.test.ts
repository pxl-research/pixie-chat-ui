import { afterEach, describe, expect, it, vi } from "vitest";

import { readKioskConfig, readKioskCopyConfig, readKioskTimingConfig } from "./config";

type RuntimeEnv = Record<string, string>;

function setRuntimeEnv(values: RuntimeEnv) {
  window.__ENV__ = values;
}

describe("readKioskCopyConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.__ENV__;
  });

  it("returns portrait-friendly default copy", () => {
    expect(readKioskCopyConfig()).toEqual({
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
    });
  });

  it("lets kiosk copy be overridden through env vars", () => {
    vi.stubEnv("VITE_ACTIVE_CLIENT_DISPLAY_NAME", "Cretskens Wine Guide");
    vi.stubEnv("VITE_ACTIVE_CLIENT_PRIMARY_COLOR", "#123456");
    vi.stubEnv("VITE_ACTIVE_CLIENT_LOGO_URL", "/branding/custom/logo.png");
    vi.stubEnv("VITE_ACTIVE_CLIENT_LOGO_NO_TEXT_URL", "/branding/custom/logo_no_text.png");
    vi.stubEnv("VITE_ACTIVE_CLIENT_BACKGROUND_IMAGE_URL", "/branding/custom/background.png");
    vi.stubEnv("VITE_ACTIVE_CLIENT_WELCOME_MESSAGE", "Speciaal geselecteerde copy");
    vi.stubEnv("VITE_ACTIVE_CLIENT_CHAT_HEADER_TITLE", "Vind jouw ideale fles");
    vi.stubEnv("VITE_KIOSK_START_LABEL", "Begin");
    vi.stubEnv("VITE_KIOSK_HELP_TEXT", "Sta dichter bij het scherm om te starten.");

    expect(readKioskCopyConfig()).toEqual({
      displayName: "Cretskens Wine Guide",
      primaryColor: "#123456",
      logoUrl: "/branding/custom/logo.png",
      logoNoTextUrl: "/branding/custom/logo_no_text.png",
      backgroundImageUrl: "/branding/custom/background.png",
      chatHeaderTitle: "Vind jouw ideale fles",
      welcomeMessage: "Speciaal geselecteerde copy",
      brandLabel: "Cretskens Wine Guide",
      welcomeTitle: "Vind jouw ideale fles",
      welcomeBody: "Speciaal geselecteerde copy",
      startLabel: "Begin",
      helpText: "Sta dichter bij het scherm om te starten.",
    });
  });

  it("prefers runtime case config over build-time env vars", () => {
    vi.stubEnv("VITE_QUESTIONER_API_BASE_URL", "https://build.example/questioner");
    vi.stubEnv("VITE_QUESTIONER_CASE_ID", "build-case");
    vi.stubEnv("VITE_ACTIVE_CLIENT_DISPLAY_NAME", "Build Name");
    vi.stubEnv("VITE_ACTIVE_CLIENT_CHAT_HEADER_TITLE", "Build Header");

    setRuntimeEnv({
      QUESTIONER_API_BASE_URL: "/questioner",
      PIXIE_QUESTIONER_CASE_ID: "runtime-case",
      KIOSK_IDLE_TIMEOUT_MS: "120000",
      KIOSK_RESET_DELAY_MS: "15000",
      ACTIVE_CLIENT_DISPLAY_NAME: "Runtime Name",
      ACTIVE_CLIENT_PRIMARY_COLOR: "#abcdef",
      ACTIVE_CLIENT_LOGO_URL: "/branding/runtime/logo.png",
      ACTIVE_CLIENT_LOGO_NO_TEXT_URL: "/branding/runtime/logo_no_text.png",
      ACTIVE_CLIENT_BACKGROUND_IMAGE_URL: "/branding/runtime/background.png",
      ACTIVE_CLIENT_WELCOME_MESSAGE: "Runtime welkom",
      ACTIVE_CLIENT_CHAT_HEADER_TITLE: "Runtime Header",
      KIOSK_START_LABEL: "Start runtime",
      KIOSK_HELP_TEXT: "Runtime hulp",
    });

    expect(readKioskConfig()).toEqual({
      questionerBaseUrl: "/questioner",
      caseId: "runtime-case",
      idleTimeoutMs: 120000,
      resetDelayMs: 15000,
    });
    expect(readKioskTimingConfig()).toEqual({
      idleTimeoutMs: 120000,
      resetDelayMs: 15000,
    });
    expect(readKioskCopyConfig()).toEqual({
      displayName: "Runtime Name",
      primaryColor: "#abcdef",
      logoUrl: "/branding/runtime/logo.png",
      logoNoTextUrl: "/branding/runtime/logo_no_text.png",
      backgroundImageUrl: "/branding/runtime/background.png",
      chatHeaderTitle: "Runtime Header",
      welcomeMessage: "Runtime welkom",
      brandLabel: "Runtime Name",
      welcomeTitle: "Runtime Header",
      welcomeBody: "Runtime welkom",
      startLabel: "Start runtime",
      helpText: "Runtime hulp",
    });
  });
});
