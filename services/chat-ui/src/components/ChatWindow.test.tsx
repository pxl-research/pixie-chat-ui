import type { ComponentProps } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatWindow } from "./ChatWindow";

function renderChatWindow(overrides?: Partial<ComponentProps<typeof ChatWindow>>) {
  const onSend = vi.fn(async () => undefined);
  const onQuickReplySelect = vi.fn(async () => undefined);

  render(
    <ChatWindow
      messages={[]}
      headerTitle="Pixie Assistant"
      onSend={onSend}
      onQuickReplySelect={onQuickReplySelect}
      quickReplies={[]}
      loading={false}
      error={null}
      isComplete={false}
      {...overrides}
    />,
  );

  return { onSend, onQuickReplySelect };
}

describe("ChatWindow", () => {
  it("renders quick replies above composer and sends selected value", async () => {
    const user = userEvent.setup();
    const { onQuickReplySelect } = renderChatWindow({
      quickReplies: [
        { label: "Ja", value: "yes" },
        { label: "Nee", value: "no" },
      ],
    });

    expect(screen.getByLabelText("Snelle antwoordopties")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ja" }));

    expect(onQuickReplySelect).toHaveBeenCalledWith("yes");
  });

  it("disables quick reply buttons while loading", () => {
    renderChatWindow({
      loading: true,
      quickReplies: [{ label: "Ja", value: "yes" }],
    });

    expect(screen.getByRole("button", { name: "Ja" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Wachten op antwoord...")).toBeDisabled();
  });

  it("hides quick replies when conversation is complete", () => {
    renderChatWindow({
      isComplete: true,
      quickReplies: [{ label: "Ja", value: "yes" }],
    });

    expect(screen.queryByLabelText("Snelle antwoordopties")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Gesprek afgerond.")).toBeDisabled();
  });

  it("shows error feedback and keeps composer available when not complete", () => {
    renderChatWindow({
      error: "Er ging iets mis.",
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Er ging iets mis.");
    expect(screen.getByPlaceholderText("Typ je bericht")).toBeEnabled();
  });
});
