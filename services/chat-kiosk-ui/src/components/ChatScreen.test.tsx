import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatScreen } from "./ChatScreen";

describe("ChatScreen", () => {
  it("renders a three-dot typing indicator while loading", () => {
    const { container } = render(
      <ChatScreen
        title="Cretskens Assistent"
        messages={[{ role: "user", content: "Ik zoek een witte wijn" }]}
        quickReplies={[]}
        loading
        onRestart={vi.fn()}
        onSendMessage={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("status", { name: "Cretskens Assistent is aan het typen" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".chat-screen__typing-dot")).toHaveLength(3);
  });

  it("scrolls to the bottom when the assistant typing bubble appears", () => {
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const messages = [{ role: "user" as const, content: "Ik zoek een witte wijn" }];

    try {
      const { rerender } = render(
        <ChatScreen
          title="Cretskens Assistent"
          messages={messages}
          quickReplies={[]}
          loading={false}
          onRestart={vi.fn()}
          onSendMessage={vi.fn()}
        />,
      );

      scrollIntoView.mockClear();

      rerender(
        <ChatScreen
          title="Cretskens Assistent"
          messages={messages}
          quickReplies={[]}
          loading
          onRestart={vi.fn()}
          onSendMessage={vi.fn()}
        />,
      );

      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("keeps the kiosk input blank and disables browser hints", () => {
    render(
      <ChatScreen
        title="Cretskens Assistent"
        messages={[]}
        quickReplies={[]}
        loading={false}
        onRestart={vi.fn()}
        onSendMessage={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Bericht" });

    expect(input).toHaveValue("");
    expect(input).not.toHaveAttribute("placeholder");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("autocorrect", "off");
    expect(input).toHaveAttribute("autocapitalize", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
  });

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

  it("renders Cretskens recommendation cards as structured results", async () => {
    const user = userEvent.setup();
    const { container } = render(
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
      screen.queryByText("Leuk, ik heb een paar mooie opties voor je klaargezet."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Domaine des Pins Sauvignon Blanc" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Frankrijk · Loire")).toBeInTheDocument();
    expect(screen.getAllByText("Geur")).toHaveLength(2);
    expect(screen.getAllByText("Smaak")).toHaveLength(2);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(
      container.querySelector(".chat-screen__recommendation-rail"),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".chat-screen__recommendation-card"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Vorige wijn" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Volgende wijn" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });
});
