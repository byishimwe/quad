import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const socketMocks = vi.hoisted(() => ({
  io: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
}));

vi.mock("socket.io-client", () => ({ io: socketMocks.io }));
vi.mock("@/lib/envValidation", () => ({ env: { socketUrl: "https://socket.example" } }));

import { connectSocket, disconnectSocket } from "@/lib/socket";

describe("Socket.IO authentication lifecycle", () => {
  beforeEach(() => {
    socketMocks.io.mockReset();
    socketMocks.disconnect.mockReset();
    socketMocks.on.mockReset();
    socketMocks.io.mockReturnValue({
      connected: false,
      disconnect: socketMocks.disconnect,
      on: socketMocks.on,
    });
  });

  afterEach(() => disconnectSocket());

  it("gets a fresh Clerk token for each connection attempt", async () => {
    let token = "first-session-token";
    const getToken = vi.fn(async () => token);
    connectSocket(getToken);

    const options = socketMocks.io.mock.calls[0][1] as {
      auth: (callback: (credentials: { token: string | null }) => void) => void;
    };
    const credentials = () =>
      new Promise<{ token: string | null }>((resolve) => options.auth(resolve));

    expect(await credentials()).toEqual({ token: "first-session-token" });
    token = "renewed-session-token";
    expect(await credentials()).toEqual({ token: "renewed-session-token" });
    expect(getToken).toHaveBeenCalledTimes(2);
  });

  it("disconnects the previous socket before connecting a new session", () => {
    connectSocket(async () => "old-token");
    connectSocket(async () => "new-token");

    expect(socketMocks.disconnect).toHaveBeenCalledTimes(1);
    expect(socketMocks.io).toHaveBeenCalledTimes(2);
  });
});
