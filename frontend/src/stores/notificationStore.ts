import { create } from "zustand";
import { NotificationService } from "@/services/notificationService";

interface NotificationState {
  unreadCount: number;
  isUnreadCountLoading: boolean;
  fetchUnreadCount: () => Promise<void>;
  incrementUnread: (delta?: number) => void;
  decrementUnread: (delta?: number) => void;
  setUnreadCount: (count: number) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  isUnreadCountLoading: false,

  fetchUnreadCount: async () => {
    try {
      set({ isUnreadCountLoading: true });
      const count = await NotificationService.getUnreadCount();
      set({ unreadCount: count });
    } catch {
      // Silently ignore errors; UI can remain with last known value
    } finally {
      set({ isUnreadCountLoading: false });
    }
  },

  incrementUnread: (delta = 1) => {
    const current = get().unreadCount;
    set({ unreadCount: current + delta });
  },

  decrementUnread: (delta = 1) => {
    const current = get().unreadCount;
    const next = Math.max(0, current - delta);
    set({ unreadCount: next });
  },

  setUnreadCount: (count: number) => {
    set({ unreadCount: count < 0 ? 0 : count });
  },
  reset: () => set({ unreadCount: 0, isUnreadCountLoading: false }),
}));
