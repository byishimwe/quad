import { useCallback, useEffect, useMemo, useState } from "react";

import type { NavigateFunction } from "react-router-dom";
import { showSuccessToast, showErrorToast } from "@/lib/error-handling/toasts";

import { NotificationService } from "@/services/notificationService";
import {
  type NotificationIdPayload,
  type NotificationPayload,
} from "@/lib/socket";
import { useSocketStore } from "@/stores/socketStore";
import type { ApiNotification } from "@/types/api";

export type FilterTab = "all" | "unread";

export function useNotificationsController({
  navigate,
  limit = 20,
}: {
  navigate: NavigateFunction;
  limit?: number;
}) {
  const socket = useSocketStore((state) => state.socket);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");

  // Load notifications
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await NotificationService.getNotifications({
          page,
          limit,
          unreadOnly: filter === "unread",
        });

        if (cancelled) return;

        const items = res.data || [];
        setNotifications((prev) => (page === 1 ? items : [...prev, ...items]));
        setHasMore(Boolean(res.pagination?.hasMore));
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof Error ? e.message : "Failed to load notifications";
          setError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [page, filter, limit]);

  // Real-time updates (new/read/delete/bulk) via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleNotificationNew = (payload: NotificationPayload) => {
      setNotifications((curr) => {
        if (curr.some((n) => n.id === payload.id)) return curr;
        if (filter === "unread" && payload.isRead) return curr;
        return [payload, ...curr];
      });
    };

    const handleNotificationRead = ({ id }: NotificationIdPayload) => {
      setNotifications((curr) => {
        const exists = curr.some((n) => n.id === id);
        if (!exists) return curr;
        if (filter === "unread") return curr.filter((n) => n.id !== id);
        return curr.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      });
    };

    const handleNotificationDeleted = ({ id }: NotificationIdPayload) => {
      setNotifications((curr) => curr.filter((n) => n.id !== id));
    };

    const handleReadAll = () => {
      setNotifications((curr) => {
        if (filter === "unread") return [];
        return curr.map((n) => ({ ...n, isRead: true }));
      });
    };

    const handleClearRead = () => {
      setNotifications((curr) => curr.filter((n) => !n.isRead));
    };

    socket.on("notification:new", handleNotificationNew);
    socket.on("notification:read", handleNotificationRead);
    socket.on("notification:deleted", handleNotificationDeleted);
    socket.on("notification:read_all", handleReadAll);
    socket.on("notification:clear_read", handleClearRead);

    return () => {
      socket.off("notification:new", handleNotificationNew);
      socket.off("notification:read", handleNotificationRead);
      socket.off("notification:deleted", handleNotificationDeleted);
      socket.off("notification:read_all", handleReadAll);
      socket.off("notification:clear_read", handleClearRead);
    };
  }, [filter, socket]);

  const unreadLocalCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) setPage((p) => p + 1);
  }, [hasMore, loading]);

  const handleFilterChange = useCallback((tab: FilterTab) => {
    setInitialLoading(true);
    setError(null);
    setPage(1);
    setNotifications([]);
    setHasMore(true);
    setFilter(tab);
  }, []);

  const handleMarkAsRead = useCallback(
    async (notification: ApiNotification) => {
      if (notification.isRead) return;
      const prev = notifications;

      try {
        // Optimistic update
        setNotifications((curr) =>
          curr.map((n) =>
            n.id === notification.id ? { ...n, isRead: true } : n,
          ),
        );

        const res = await NotificationService.markAsRead(notification.id);
        if (!res.success) throw new Error(res.message);
      } catch {
        setNotifications(prev);
        showErrorToast("Failed to mark as read");
      }
    },
    [notifications],
  );

  const handleDelete = useCallback(
    async (notification: ApiNotification) => {
      const prev = notifications;
      try {
        // Optimistic update
        setNotifications((curr) =>
          curr.filter((n) => n.id !== notification.id),
        );

        const res = await NotificationService.deleteNotification(
          notification.id,
        );
        if (!res.success) throw new Error(res.message);
        showSuccessToast("Notification deleted");
      } catch {
        setNotifications(prev);
        showErrorToast("Failed to delete notification");
      }
    },
    [notifications],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    const prev = notifications;

    try {
      setNotifications((curr) => curr.map((n) => ({ ...n, isRead: true })));

      const res = await NotificationService.markAllAsRead();
      if (!res.success) throw new Error(res.message);
      showSuccessToast("All marked as read");
    } catch {
      setNotifications(prev);
      showErrorToast("Failed to mark all as read");
    }
  }, [notifications]);

  const handleClearRead = useCallback(async () => {
    const prev = notifications;

    try {
      setNotifications((curr) => curr.filter((n) => !n.isRead));

      const res = await NotificationService.deleteAllRead();
      if (!res.success) throw new Error(res.message);
      showSuccessToast("Read notifications cleared");
    } catch {
      setNotifications(prev);
      showErrorToast("Failed to clear read");
    }
  }, [notifications]);

  const resolveNotificationTarget = useCallback(
    (notification: ApiNotification) => {
      const { contentType, contentId, type, actor } = notification;

      const normalizedContentType = contentType?.toLowerCase();

      if (normalizedContentType === "post" && contentId)
        return `/posts/${contentId}`;
      if (normalizedContentType === "story" && contentId)
        return `/stories/${contentId}`;
      if (normalizedContentType === "poll" && contentId) return "/polls";
      if (
        normalizedContentType &&
        ["chat", "conversation", "chatmessage"].includes(
          normalizedContentType,
        ) &&
        contentId
      )
        return `/chat/${contentId}`;

      if (type === "chat_mention")
        return contentId ? `/chat/${contentId}` : "/chat";
      if (type === "follow" && actor?.username)
        return `/profile/${actor.username}`;

      return null;
    },
    [],
  );

  const handleNavigate = useCallback(
    (notification: ApiNotification) => {
      const target = resolveNotificationTarget(notification);
      if (!target) return;

      if (!notification.isRead) {
        void handleMarkAsRead(notification);
      }

      navigate(target);
    },
    [handleMarkAsRead, navigate, resolveNotificationTarget],
  );

  return {
    notifications,
    hasMore,
    loading,
    initialLoading,
    error,
    filter,
    unreadLocalCount,
    handleLoadMore,
    handleFilterChange,
    handleMarkAsRead,
    handleDelete,
    handleMarkAllAsRead,
    handleClearRead,
    handleNavigate,
  };
}
