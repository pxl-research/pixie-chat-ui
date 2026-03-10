import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import App from "./App";

it("shows the start screen first and enters chat after tapping start", async () => {
  const user = userEvent.setup();

  render(<App />);

  await user.click(screen.getByRole("button", { name: "Start gesprek" }));

  expect(screen.getByRole("textbox", { name: "Bericht" })).toBeInTheDocument();
});
