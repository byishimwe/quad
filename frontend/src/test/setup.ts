// Test setup file for vitest
import { vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(() => ({
    isLoaded: true,
    isSignedIn: true,
    userId: "test-user-id",
    sessionId: "test-session-id",
    sessionClaims: {
      __raw: "mock-jwt",
      iss: "https://clerk.test",
      sid: "test-session-id",
      sub: "test-user-id",
      iat: 1234567890,
      exp: 1234567890,
      nbf: 1234567890,
      jti: "test-jti",
      azp: "test-azp",
    } as any,
    actor: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    has: vi.fn(() => false),
    getToken: vi.fn(async () => "mock-test-jwt-token"),
    signOut: vi.fn(async () => undefined),
  })),
  useUser: vi.fn(() => ({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: "test-user-id",
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      publicMetadata: {},
      unsafeMetadata: {},
    } as any,
  })),
  ClerkProvider: ({ children }: { children: any }) => children,
  SignedIn: ({ children }: { children: any }) => children,
  SignedOut: () => null,
  RedirectToSignIn: () => null,
}));

// JSDOM provides its own Event implementations. Node also provides WHATWG Event
// implementations, which can be incompatible with JSDOM's dispatchEvent.
// Ensure global constructors point at the JSDOM versions.
global.Event = window.Event;
global.CustomEvent = window.CustomEvent;
global.MouseEvent = window.MouseEvent;
global.FocusEvent = (window as any).FocusEvent ?? window.Event;

// Mock localStorage with actual storage
const storage: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => storage[key] || null,
  setItem: (key: string, value: string) => {
    storage[key] = value;
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    Object.keys(storage).forEach((key) => delete storage[key]);
  },
  get length() {
    return Object.keys(storage).length;
  },
  key: (index: number) => {
    const keys = Object.keys(storage);
    return keys[index] || null;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorageMock,
});
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: localStorageMock,
});

// Set up a mock auth token for all tests
beforeEach(async () => {
  // Set a mock JWT token for authenticated requests
  localStorage.setItem("clerk-db-jwt", "mock-test-jwt-token");

  // Reset Clerk hook defaults for each test to avoid cross-test leakage from mockReturnValue
  const clerk = vi.mocked(await import("@clerk/clerk-react"));
  clerk.useAuth.mockImplementation(() => ({
    isLoaded: true,
    isSignedIn: true,
    userId: "test-user-id",
    sessionId: "test-session-id",
    sessionClaims: {
      __raw: "mock-jwt",
      iss: "https://clerk.test",
      sid: "test-session-id",
      sub: "test-user-id",
      iat: 1234567890,
      exp: 1234567890,
      nbf: 1234567890,
      jti: "test-jti",
      azp: "test-azp",
    } as any,
    actor: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    has: vi.fn(() => false),
    getToken: vi.fn(async () => "mock-test-jwt-token"),
    signOut: vi.fn(async () => undefined),
  }));
  clerk.useUser.mockImplementation(() => ({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: "test-user-id",
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      publicMetadata: {},
      unsafeMetadata: {},
    } as any,
  }));
});

// Mock rate limit handler module
vi.mock("@/lib/rateLimitHandler", () => ({
  rateLimitManager: {
    recordRateLimit: vi.fn(),
    isRateLimited: vi.fn(() => false),
    getRateLimitInfo: vi.fn(() => null),
  },
}));

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
