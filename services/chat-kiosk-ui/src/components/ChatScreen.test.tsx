import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatScreen } from "./ChatScreen";

describe("ChatScreen", () => {
  it("submits typed messages and quick replies", async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn(async () => undefined);
    const onRestart = vi.fn();

    render(
      <ChatScreen
        title="Cretskens Assistent"
        messages={[
          { role: "assistant", content: "Welkom bij Cretskens" },
        ]}
        quickReplies={[
          { label: "Ja", value: "yes" },
          { label: "Nee", value: "no" },
        ]}
        loading={false}
        onRestart={onRestart}
        onSendMessage={onSendMessage}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Bericht" }), "Hallo");
    await user.click(screen.getByRole("button", { name: "Versturen" }));
    await user.click(screen.getByRole("button", { name: "Ja" }));

    expect(onSendMessage).toHaveBeenNthCalledWith(1, "Hallo");
    expect(onSendMessage).toHaveBeenNthCalledWith(2, "yes");
    expect(onRestart).not.toHaveBeenCalled();
  });
});
