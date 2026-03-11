import { afterEach, describe, expect, it, vi } from "vitest";

import { readKioskCopyConfig } from "./config";

describe("readKioskCopyConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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
});
