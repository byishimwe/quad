import { createRef } from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ChatMessageList } from "@/pages/chat/ChatMessageList";
import type { ChatMessage } from "@/types/chat";

const url = "https://example.com/hello";
const self = { clerkId: "sender-id", username: "sender" };
const other = { clerkId: "receiver-id", username: "receiver" };

function message(id: string, author: typeof self): ChatMessage {
  return {
    id,
    author: { ...author, email: `${author.username}@example.com` },
    text: `Take a look: ${url}`,
    mentions: [],
    isEdited: false,
    editedAt: null,
    timestamp: "Just now",
    createdAt: "2026-10-08T08:00:00.000Z",
    updatedAt: "2026-10-08T08:00:00.000Z",
  };
}

function renderList(messages: ChatMessage[], pendingOutgoingText?: string) {
  return render(
    <MemoryRouter>
      <ChatMessageList
        listRef={createRef<HTMLDivElement>()}
        loading={false}
        loadingOlder={false}
        hasMoreOlder={false}
        onLoadOlder={vi.fn()}
        messages={messages}
        pendingOutgoingText={pendingOutgoingText}
        user={self}
        onStartEdit={vi.fn()}
        onDeleteMessage={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("chat URL contrast", () => {
  it("uses readable contrast for an outgoing link on the primary bubble", () => {
    renderList([message("outgoing", self)]);
    const link = screen.getByRole("link", { name: url });
    expect(link).toHaveAttribute("href", url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
    expect(link).toHaveClass("text-primary-foreground", "underline");
    expect(link).not.toHaveClass("text-primary");
  });

  it("keeps incoming links highlighted on neutral bubbles", () => {
    renderList([message("incoming", other)]);
    const link = screen.getByRole("link", { name: url });
    expect(link).toHaveClass("text-primary", "underline");
    expect(link).not.toHaveClass("text-primary-foreground");
  });

  it("linkifies the unsent outgoing preview as well", () => {
    renderList([], `Take a look: ${url}`);
    const link = screen.getByRole("link", { name: url });
    expect(link).toHaveClass("text-primary-foreground", "underline");
  });

  it("preserves surrounding text and multiple URLs", () => {
    renderList([{ ...message("outgoing", self), text: `First ${url} then https://example.org/done` }]);
    expect(screen.getByText(/First/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: url })).toHaveAttribute("href", url);
    expect(screen.getByRole("link", { name: "https://example.org/done" })).toHaveAttribute("href", "https://example.org/done");
  });
});
