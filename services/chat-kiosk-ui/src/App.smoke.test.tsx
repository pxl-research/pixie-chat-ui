import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import App from "./App";

it("renders the kiosk start screen", () => {
  render(<App />);

  expect(screen.getByRole("button", { name: "Start gesprek" })).toBeInTheDocument();
});
