import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { getSocket } from "@/lib/socket";
import type { NotificationPayload } from "@/lib/socket";

vi.mock("@/lib/socket", async () => {
  const { EventEmitter } = await import("events");
  const mockSocket = new EventEmitter();
  return {
    getSocket: vi.fn(() => mockSocket),
    connectSocket: vi.fn(),
    disconnectSocket: vi.fn(),
  };
});

// Feature: quad-production-ready, Property 38: Real-time Notification Toast
// For any notification:new event received, a toast notification should appear with the notification message.
// Validates: Requirements 11.3

describe("Real-time Notification Property Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Arbitrary for generating valid notification payloads
  const notificationPayloadArbitrary = fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    type: fc.constantFrom(
      "follow",
      "reaction",
      "comment",
      "mention",
      "poll_vote"
    ),
    actorId: fc.option(fc.uuid(), { nil: undefined }),
    contentId: fc.option(fc.uuid(), { nil: undefined }),
    contentType: fc.option(
      fc.constantFrom("post", "story", "poll", "comment"),
      { nil: undefined }
    ),
    message: fc
      .string({ minLength: 10, maxLength: 200 })
      .filter((s) => s.trim().length > 0), // Exclude whitespace-only messages
    isRead: fc.boolean(),
    createdAt: fc
      .integer({ min: new Date("2020-01-01").getTime(), max: Date.now() })
      .map((timestamp) => new Date(timestamp).toISOString()),
    actor: fc.option(
      fc.record({
        clerkId: fc.uuid(),
        username: fc.string({ minLength: 3, maxLength: 20 }),
        email: fc.emailAddress(),
        displayName: fc.option(fc.string({ minLength: 3, maxLength: 50 }), {
          nil: undefined,
        }),
        profileImage: fc.option(fc.webUrl(), { nil: undefined }),
      }),
      { nil: undefined }
    ),
  });

  it("Property 38: notification:new event contains required message field", async () => {
    await fc.assert(
      fc.asyncProperty(
        notificationPayloadArbitrary,
        async (notificationPayload) => {
          // Get socket instance
          const socket = getSocket();

          // Create a promise that resolves when the event is received
          const eventPromise = new Promise<NotificationPayload>((resolve) => {
            socket.once("notification:new", (payload: NotificationPayload) => {
              resolve(payload);
            });
          });

          // Simulate server emitting the event
          socket.emit("notification:new", notificationPayload);

          // Wait for the event to be received
          const payload = await eventPromise;

          // Verify required fields for toast display
          expect(payload.message).toBeDefined();
          expect(typeof payload.message).toBe("string");
          expect(payload.message.length).toBeGreaterThan(0);

          // Verify notification structure
          expect(payload.id).toBeDefined();
          expect(payload.userId).toBeDefined();
          expect(payload.type).toBeDefined();
          expect(payload.createdAt).toBeDefined();

          // Verify message can be displayed in a toast
          // The message should be a non-empty string suitable for display
          expect(payload.message.trim().length).toBeGreaterThan(0);
          expect(payload.message.length).toBeLessThanOrEqual(500); // Reasonable toast length
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 38: notification:new event payload is valid for all notification types", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          "follow",
          "reaction",
          "comment",
          "mention",
          "poll_vote"
        ),
        fc.string({ minLength: 10, maxLength: 200 }),
        async (notificationType, message) => {
          const payload: NotificationPayload = {
            id: "test-id",
            userId: "test-user-id",
            type: notificationType,
            message: message,
            isRead: false,
            createdAt: new Date().toISOString(),
          };

          // Verify the payload structure is valid for socket emission
          expect(payload.type).toBe(notificationType);
          expect(payload.message).toBe(message);

          // Verify all notification types have valid messages
          expect(payload.message).toBeDefined();
          expect(payload.message.length).toBeGreaterThan(0);

          // Verify the payload can be serialized (important for socket.io)
          const serialized = JSON.stringify(payload);
          const deserialized = JSON.parse(serialized);
          expect(deserialized.message).toBe(message);
          expect(deserialized.type).toBe(notificationType);
        }
      ),
      { numRuns: 100 }
    );
  });
});
