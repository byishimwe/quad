import { io, Socket } from "socket.io-client";
import type { ApiNotification } from "@/types/api";
import { env } from "@/lib/envValidation";

const SOCKET_URL = env.socketUrl;

let socket: Socket | null = null;

export function connectSocket(getToken: () => Promise<string | null>): Socket {
  if (socket?.connected) {
    return socket;
  }

  // Disconnect existing socket if any (e.g. reconnecting with new token)
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    // Socket.IO invokes this before each connection, including reconnections.
    auth: (callback) => {
      void getToken()
        .then((token) => callback({ token }))
        .catch(() => callback({ token: null }));
    },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 20, // More attempts for better reliability
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000, // Caps the exponential backoff
    randomizationFactor: 0.5,
  });

  socket.on("connect", () => {
    if (import.meta.env.DEV) {
      console.log("Socket connected:", socket?.id);
    }
  });

  socket.on("connect_error", (err) => {
    if (import.meta.env.DEV) {
      console.error("Socket connection error:", err.message);
    }
  });

  socket.on("disconnect", (reason) => {
    if (import.meta.env.DEV) {
      console.log("Socket disconnected:", reason);
    }
  });

  return socket;
}

export function getSocket(): Socket {
  if (!socket) {
    throw new Error("Socket not initialized. Call connectSocket(token) first.");
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export type FeedNewContentPayload = {
  contentType: "post" | "poll" | "story";
  contentId: string;
  authorId: string;
  timestamp: string | number;
};

export type FeedEngagementUpdatePayload = {
  contentType: "post" | "poll" | "story";
  contentId: string;
  reactionsCount?: number;
  commentsCount?: number;
  votes?: number;
  timestamp: string | number;
};

export type FeedContentDeletedPayload = {
  contentType: "post" | "poll" | "story";
  contentId: string;
  timestamp: string | number;
};

export type PollVotedPayload = {
  pollId: string;
  updatedVoteCounts: number[];
  totalVotes: number;
};

// Chat payloads

export type ChatMessagePayload = {
  id: string;
  author: {
    clerkId: string;
    username: string;
    email: string;
    profileImage?: string;
    bio?: string;
  };
  text?: string;
  mentions: string[];
  isEdited: boolean;
  editedAt?: string | null;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatTypingStartPayload = {
  userId: string;
  username: string;
};

export type ChatTypingStopPayload = {
  userId: string;
};

// Notifications

export type NotificationPayload = ApiNotification;

export type NotificationUnreadCountPayload = { unreadCount: number };

export type NotificationIdPayload = { id: string };
