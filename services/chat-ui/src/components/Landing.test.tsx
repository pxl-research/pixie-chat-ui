import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ClientConfig } from "../config/client";
import { Landing } from "./Landing";

const client: ClientConfig = {
  id: "demo",
  displayName: "Demo",
  theme: {},
  landing: {
    title: "Welkom bij de assistent",
    researchNote: "Onderzoekstekst.",
    privacyNote: "Privacytekst.",
    startLabel: "Start chat",
    presets: [
      { label: "Ja", prefill: "Ja" },
      { label: "Nee", prefill: "Nee" },
    ],
  },
};

describe("Landing", () => {
  it("renders and remains functional on small viewport widths", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    window.dispatchEvent(new Event("resize"));

    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<Landing client={client} onStart={onStart} loading={false} />);

    expect(screen.getByText("Welkom bij de assistent")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start chat" }));
    await user.click(screen.getByRole("button", { name: "Ja" }));

    expect(onStart).toHaveBeenNthCalledWith(1);
    expect(onStart).toHaveBeenNthCalledWith(2, "Ja");
  });
});
