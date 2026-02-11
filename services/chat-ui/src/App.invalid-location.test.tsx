import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { fetchClientConfig } from "./config/client";

vi.mock("./config/client", () => ({
  fetchClientConfig: vi.fn(),
}));

vi.mock("./hooks/useChat", () => ({
  useChat: () => ({
    messages: [],
    loading: false,
    error: null,
    sendMessage: vi.fn(),
    reset: vi.fn(),
    isComplete: false,
    activeQuickReplies: [],
  }),
}));

const mockedFetchClientConfig = vi.mocked(fetchClientConfig);

describe("App invalid location state", () => {
  beforeEach(() => {
    mockedFetchClientConfig.mockResolvedValue({
      id: "demo",
      displayName: "Demo",
      theme: {},
      allowedLocations: ["pashokje"],
      landing: {
        title: "Welkom",
        researchNote: "Onderzoek",
        privacyNote: "Privacy",
        startLabel: "Start",
        presets: [],
      },
    });
  });

  it("shows the invalid-location panel when location query param is missing", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Deze chatlink is ongeldig.")).toBeInTheDocument();
    });
    expect(screen.getByText("De locatieparameter ontbreekt in de URL.")).toBeInTheDocument();
  });
});
