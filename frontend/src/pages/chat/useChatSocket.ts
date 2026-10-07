import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { ChatMessage } from "@/types/chat";
import type {
  ChatMessagePayload,
  ChatTypingStartPayload,
  ChatTypingStopPayload,
} from "@/lib/socket";

import type { ConnectionStatus } from "./types";
import { useSocketStore } from "@/stores/socketStore";

type MinimalUser = {
  clerkId: string;
  username: string;
};

export function useChatSocket({
  user,
  nearBottom,
  scrollToBottom,
  setMessages,
  onIncomingMessage,
}: {
  user: MinimalUser | null | undefined;
  nearBottom: boolean;
  scrollToBottom: () => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  onIncomingMessage?: () => void;
}) {
  const socket = useSocketStore((state) => state.socket);

  const [connection, setConnection] = useState<ConnectionStatus>(() => {
    if (!socket) return "disconnected";
    return socket.connected ? "connected" : "connecting";
  });

  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!socket) {
      return;
    }

    const onConnect = () => setConnection("connected");
    const onDisconnect = () => setConnection("disconnected");
    const onConnectError = () => setConnection("disconnected");
    const onReconnectAttempt = () => setConnection("connecting");

    const onNew = (payload: ChatMessagePayload) => {
      let appended = false;
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.id)) return prev;
        appended = true;
        return [...prev, payload as unknown as ChatMessage];
      });

      if (!appended) return;
      onIncomingMessage?.();
      if (nearBottom) requestAnimationFrame(() => scrollToBottom());
    };

    const onEdited = (payload: ChatMessagePayload) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.id ? (payload as unknown as ChatMessage) : m,
        ),
      );
    };

    const onDeleted = (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    };

    const onTypingStart = (p: ChatTypingStartPayload) => {
      if (p.userId === user?.clerkId) return;
      setTypingUsers((prev) => ({ ...prev, [p.userId]: p.username }));
      setTimeout(() => {
        setTypingUsers((curr) => {
          const copy = { ...curr };
          delete copy[p.userId];
          return copy;
        });
      }, 3000);
    };

    const onTypingStop = (p: ChatTypingStopPayload) => {
      setTypingUsers((prev) => {
        const copy = { ...prev };
        delete copy[p.userId];
        return copy;
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);

    socket.on("chat:message:new", onNew);
    socket.on("chat:message:edited", onEdited);
    socket.on("chat:message:deleted", onDeleted);
    socket.on("chat:typing:start", onTypingStart);
    socket.on("chat:typing:stop", onTypingStop);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);

      socket.off("chat:message:new", onNew);
      socket.off("chat:message:edited", onEdited);
      socket.off("chat:message:deleted", onDeleted);
      socket.off("chat:typing:start", onTypingStart);
      socket.off("chat:typing:stop", onTypingStop);
    };
  }, [
    socket,
    user?.clerkId,
    nearBottom,
    scrollToBottom,
    setMessages,
    onIncomingMessage,
  ]);

  const emitTypingStart = () => {
    if (!user || !socket) return;
    socket.emit("chat:typing:start", {
      userId: user.clerkId,
      username: user.username,
    });
  };

  const emitTypingStop = () => {
    if (!user || !socket) return;
    socket.emit("chat:typing:stop", { userId: user.clerkId });
  };

  return {
    connection: socket ? connection : "disconnected",
    typingUsers,
    emitTypingStart,
    emitTypingStop,
  };
}
