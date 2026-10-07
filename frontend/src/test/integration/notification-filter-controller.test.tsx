import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationsController } from "@/pages/notifications/useNotificationsController";
import { NotificationService } from "@/services/notificationService";
import type { ApiNotification } from "@/types/api";

const notification: ApiNotification = {
  id: "notification-1",
  userId: "test-user-id",
  type: "follow",
  message: "Someone followed you",
  isRead: false,
  createdAt: "2026-10-07T12:00:00.000Z",
};

describe("notification filter controller", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps loaded notifications when the active filter is selected again", async () => {
    const getNotifications = vi
      .spyOn(NotificationService, "getNotifications")
      .mockResolvedValue({
        success: true,
        data: [notification],
        pagination: { page: 1, limit: 20, total: 1, pages: 1, hasMore: false },
      });
    const navigate = vi.fn();
    const { result } = renderHook(() =>
      useNotificationsController({ navigate, limit: 20 }),
    );

    await waitFor(() => expect(result.current.initialLoading).toBe(false));
    expect(result.current.notifications).toEqual([notification]);

    act(() => result.current.handleFilterChange("all"));

    expect(result.current.initialLoading).toBe(false);
    expect(result.current.notifications).toEqual([notification]);
    expect(getNotifications).toHaveBeenCalledTimes(1);
  });
});
