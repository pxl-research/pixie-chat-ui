import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import App from "./App";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("renders the portrait-first kiosk start screen copy", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", {
      name: "Cretskens Wijnassistent",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Hallo, ik ben je Cretskens AI-assistent. Ik help je graag om de juiste wijn bij je gerecht te vinden. Vertel me wat je gaat eten, dan maak ik een duidelijke samenvatting voor gericht advies in de winkel.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "CRETSKENS" })).toBeInTheDocument();
  expect(
    screen.getByText("Tik op start en laat je stap voor stap begeleiden."),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start gesprek" })).toBeInTheDocument();
});
