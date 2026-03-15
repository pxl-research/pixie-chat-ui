import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatScreen } from "./ChatScreen";

describe("ChatScreen", () => {
  it("submits typed messages and quick replies", async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn(async () => undefined);
    const onRestart = vi.fn();

    const { container } = render(
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

    expect(container.querySelector(".chat-screen__viewport")).toBeInTheDocument();
    expect(container.querySelector(".chat-screen__action-rail")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Bericht" }), "Hallo");
    await user.click(screen.getByRole("button", { name: "Versturen" }));
    await user.click(screen.getByRole("button", { name: "Ja" }));

    expect(onSendMessage).toHaveBeenNthCalledWith(1, "Hallo");
    expect(onSendMessage).toHaveBeenNthCalledWith(2, "yes");
    expect(onRestart).not.toHaveBeenCalled();
  });

  it("renders Cretskens recommendation cards as structured results", () => {
    render(
      <ChatScreen
        title="Cretskens Assistent"
        messages={[
          { role: "assistant", content: "Welkom bij Cretskens" },
          { role: "user", content: "Ik zoek een frisse witte wijn" },
        ]}
        recommendations={{
          intro: "Leuk, ik heb een paar mooie opties voor je klaargezet.",
          items: [
            {
              name: "Domaine des Pins Sauvignon Blanc",
              country: "Frankrijk",
              region: "Loire",
              aromaDescription: "Citrus en witte bloemen",
              tasteDescription: "Fris en strak",
            },
            {
              name: "Casa Azul Verdejo",
              country: "Spanje",
              region: "Rueda",
              aromaDescription: "Tropisch fruit en venkel",
              tasteDescription: "Droog en rond",
            },
          ],
        }}
        quickReplies={[]}
        loading={false}
        onRestart={vi.fn()}
        onSendMessage={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Leuk, ik heb een paar mooie opties voor je klaargezet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Domaine des Pins Sauvignon Blanc" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Frankrijk · Loire")).toBeInTheDocument();
    expect(screen.getAllByText("Geur")).toHaveLength(2);
    expect(screen.getAllByText("Smaak")).toHaveLength(2);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });
});
