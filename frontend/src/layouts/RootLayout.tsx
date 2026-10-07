import { Outlet, useLocation } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { useThemeStore } from "../stores/themeStore";
import { useAuthSync } from "../hooks/useAuthSync";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import {
  type NotificationPayload,
  type NotificationUnreadCountPayload,
} from "@/lib/socket";
import { useNotificationStore } from "@/stores/notificationStore";
import { useFollowStore, type FollowEventPayload } from "@/stores/followStore";
import { useSocketStore } from "@/stores/socketStore";

export function RootLayout() {
  const location = useLocation();
  // Sync auth state with Clerk
  useAuthSync();
  const { user, isLoading } = useAuthStore();
  const joinedRef = useRef<string | null>(null);
  const { fetchUnreadCount, setUnreadCount } = useNotificationStore();
  const applyFollowNewEvent = useFollowStore((s) => s.applyFollowNewEvent);
  const applyFollowRemovedEvent = useFollowStore(
    (s) => s.applyFollowRemovedEvent,
  );
  // Get socket from store - this will update when initialized
  const socket = useSocketStore((state) => state.socket);

  // Initialize theme system
  const { initializeTheme, applyTheme } = useThemeStore();

  useEffect(() => {
    initializeTheme();
    applyTheme();
  }, [initializeTheme, applyTheme]);

  useEffect(() => {
    const path = location.pathname;
    const title = path === "/" || path === "/feed" ? "Quad | Your Campus, Connected"
      : path.startsWith("/login") ? "Sign In | Quad"
      : path.startsWith("/signup") ? "Create Account | Quad"
      : path.startsWith("/polls") || path.includes("poll") ? "Polls | Quad"
      : path.startsWith("/stories") || path.includes("story") ? "Stories | Quad"
      : path.startsWith("/chat") ? "Chat | Quad"
      : path.startsWith("/notifications") ? "Notifications | Quad"
      : path.startsWith("/profile") ? "Profile | Quad"
      : path.startsWith("/posts") ? "Post | Quad"
      : "Page Not Found | Quad";
    document.title = title;
  }, [location.pathname]);

  // Socket feed + notifications join/leave and listeners
  useEffect(() => {
    const userId = user?.clerkId;

    // Use socket from store. If null, we simply wait.
    if (isLoading || !userId || !socket) {
      return;
    }

    const joinRooms = () => {
      socket.emit("feed:join", userId);
      socket.emit("notification:join", userId);
    };

    // Join once for this user id (and re-join on reconnect)
    if (joinedRef.current !== userId) {
      joinRooms();
      joinedRef.current = userId;
    }

    socket.on("connect", joinRooms);

    // Initial unread count sync for this session
    void fetchUnreadCount();

    const handleNotificationNew = (payload: NotificationPayload) => {
      toast(payload.message, {
        position: "top-right",
      });
    };

    const handleUnreadCount = (payload: NotificationUnreadCountPayload) => {
      setUnreadCount(payload.unreadCount);
    };

    const handleFollowNew = (payload: FollowEventPayload) => {
      applyFollowNewEvent(payload);
    };

    const handleFollowRemoved = (payload: FollowEventPayload) => {
      applyFollowRemovedEvent(payload);
    };

    socket.on("notification:new", handleNotificationNew);
    socket.on("notification:unread_count", handleUnreadCount);
    socket.on("follow:new", handleFollowNew);
    socket.on("follow:removed", handleFollowRemoved);

    return () => {
      socket.off("notification:new", handleNotificationNew);
      socket.off("notification:unread_count", handleUnreadCount);
      socket.off("follow:new", handleFollowNew);
      socket.off("follow:removed", handleFollowRemoved);
      socket.off("connect", joinRooms);
      if (userId) {
        socket.emit("feed:leave", userId);
        socket.emit("notification:leave", userId);
      }
    };
  }, [
    isLoading,
    user?.clerkId,
    socket, // Add socket dependency so effect re-runs when socket connects
    fetchUnreadCount,
    setUnreadCount,
    applyFollowNewEvent,
    applyFollowRemovedEvent,
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />

      {/* Global Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          className: "bg-card text-card-foreground border border-border",
          duration: 4000,
          ariaProps: {
            role: "status",
            "aria-live": "polite",
          },
        }}
      />

      {/* ARIA Live Region for Screen Readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="aria-live-region"
      />
    </div>
  );
}
