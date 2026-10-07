import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachInterceptors } from "@/lib/api/interceptors";
import { requestCache } from "@/lib/requestCache";
import { rateLimitState } from "@/lib/api/rateLimitState";
import { useAuthStore } from "@/stores/authStore";

type TestClerk = { user: { id: string }; session: { id: string; getToken: () => Promise<string> } };

function session(userId: string, sessionId: string): TestClerk {
  return { user: { id: userId }, session: { id: sessionId, getToken: async () => `token-${userId}` } };
}

describe("authenticated API session and retry behavior", () => {
  const api = axios.create();
  attachInterceptors(api);
  const mock = new MockAdapter(api);

  beforeEach(() => {
    (window as unknown as { Clerk: TestClerk }).Clerk = session("user-a", "session-a");
    requestCache.clear();
    rateLimitState.clear();
    mock.reset();
  });

  afterEach(() => {
    mock.reset();
    requestCache.clear();
    rateLimitState.clear();
    vi.restoreAllMocks();
  });

  it("fetches again for user B after A signs out", async () => {
    let hits = 0;
    mock.onGet("/bookmarks").reply(() => [200, { owner: ++hits }]);

    expect((await api.get("/bookmarks")).data.owner).toBe(1);
    expect((await api.get("/bookmarks")).data.owner).toBe(1);
    useAuthStore.getState().logout();
    (window as unknown as { Clerk: TestClerk }).Clerk = session("user-b", "session-b");
    expect((await api.get("/bookmarks")).data.owner).toBe(2);
    expect(hits).toBe(2);
  });

  it("scopes cached responses to a Clerk session even for the same user", async () => {
    let hits = 0;
    mock.onGet("/notifications").reply(() => [200, { version: ++hits }]);
    await api.get("/notifications");
    (window as unknown as { Clerk: TestClerk }).Clerk = session("user-a", "session-new");
    expect((await api.get("/notifications")).data.version).toBe(2);
  });

  it("retries transient GET failures through the configured count", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    mock.onGet("/feed").replyOnce(503).onGet("/feed").replyOnce(502).onGet("/feed").reply(200, { ok: true });
    expect((await api.get("/feed")).data.ok).toBe(true);
    expect(mock.history.get).toHaveLength(3);
  });

  it("never retries a failed mutation", async () => {
    mock.onPost("/posts").reply(503);
    await expect(api.post("/posts", { text: "hello" })).rejects.toMatchObject({ response: { status: 503 } });
    expect(mock.history.post).toHaveLength(1);
  });

  it("does not let a write rate limit block an unrelated read", async () => {
    mock.onPost("/posts").reply(429, {}, { "retry-after": "30" });
    mock.onGet("/notifications").reply(200, { ok: true });
    await expect(api.post("/posts", {})).rejects.toMatchObject({ response: { status: 429 } });
    expect((await api.get("/notifications")).data.ok).toBe(true);
    expect(mock.history.get).toHaveLength(1);
  });
});
