import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import App from "./App";

it("shows the start screen first and enters chat after tapping start", async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  expect(container.querySelector(".kiosk-shell")).toHaveClass("kiosk-shell--start");

  await user.click(screen.getByRole("button", { name: "Start gesprek" }));

  expect(container.querySelector(".kiosk-shell")).toHaveClass("kiosk-shell--chat");
  expect(
    screen.getByRole("heading", { name: "Cretskens Wijnassistent" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Bericht" })).toBeInTheDocument();
});
