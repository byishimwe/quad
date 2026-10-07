/**
 * Property-Based Tests for Protected Route Authentication
 *
 * Feature: quad-production-ready, Property 56: Protected Route Authentication Check
 * Validates: Requirements 15.4
 *
 * For any protected route access, authentication should be verified before rendering the route content.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth, useUser } from "@clerk/clerk-react";
import * as fc from "fast-check";

// Test component that should be protected
function ProtectedContent() {
  return <div data-testid="protected-content">Protected Content</div>;
}

// Login page component
function LoginPage() {
  return <div data-testid="login-page">Login Page</div>;
}

// Helper to render with router
function renderWithProviders(
  initialPath: string,
  isSignedIn: boolean,
  isLoaded: boolean,
) {
  // Mock useAuth hook
  vi.mocked(useAuth).mockReturnValue(
    (isLoaded
      ? {
          isSignedIn,
          isLoaded: true as const,
          getToken: vi.fn().mockResolvedValue("mock-token"),
        }
      : {
          isSignedIn: false as const,
          isLoaded: false as const,
          getToken: vi.fn().mockResolvedValue("mock-token"),
        }) as unknown as ReturnType<typeof useAuth>,
  );

  vi.mocked(useUser).mockReturnValue(
    (isLoaded
      ? {
          user: null,
          isLoaded: true as const,
          isSignedIn,
        }
      : {
          user: null,
          isLoaded: false as const,
          isSignedIn: false as const,
        }) as unknown as ReturnType<typeof useUser>,
  );

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <ProtectedContent />
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Property 56: Protected Route Authentication Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("should redirect unauthenticated users to login for any protected route", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random protected route paths
        fc.constantFrom(
          "/",
          "/profile/testuser",
          "/posts/123",
          "/chat",
          "/notifications",
          "/settings",
          "/polls",
        ),
        async (protectedPath) => {
          // Clean up before each property test iteration
          cleanup();
          sessionStorage.clear();

          // Render with unauthenticated state
          renderWithProviders(protectedPath, false, true);

          // Should redirect to login page
          await waitFor(() => {
            const loginPages = screen.queryAllByTestId("login-page");
            expect(loginPages.length).toBeGreaterThan(0);
          });

          // Should NOT show protected content
          expect(
            screen.queryByTestId("protected-content"),
          ).not.toBeInTheDocument();

          // Should save intended destination
          const savedPath = sessionStorage.getItem("redirectAfterLogin");
          expect(savedPath).toBe(protectedPath);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("should allow authenticated users to access any protected route", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random protected route paths
        fc.constantFrom(
          "/",
          "/profile/testuser",
          "/posts/123",
          "/chat",
          "/notifications",
          "/settings",
          "/polls",
        ),
        async (protectedPath) => {
          // Clean up before each property test iteration
          cleanup();
          sessionStorage.clear();

          // Render with authenticated state
          renderWithProviders(protectedPath, true, true);

          // Should show protected content
          await waitFor(() => {
            const protectedContent =
              screen.queryAllByTestId("protected-content");
            expect(protectedContent.length).toBeGreaterThan(0);
          });

          // Should NOT show login page
          expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
        },
      ),
      { numRuns: 30 },
    );
  });

  it("should show loading state while authentication is being verified", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("/", "/profile/testuser", "/posts/123"),
        fc.boolean(), // isSignedIn doesn't matter when not loaded
        async (protectedPath, isSignedIn) => {
          // Clean up before each property test iteration
          cleanup();
          sessionStorage.clear();

          // Render with loading state (isLoaded = false)
          renderWithProviders(protectedPath, isSignedIn, false);

          // Should show loading indicator (MainAppSkeleton)
          const skeleton = document.querySelector(".animate-pulse");
          expect(skeleton).toBeInTheDocument();

          // Should NOT show protected content or login page yet
          expect(
            screen.queryByTestId("protected-content"),
          ).not.toBeInTheDocument();
          expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
        },
      ),
      { numRuns: 30 },
    );
  });

  it("should preserve query parameters when redirecting to login", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("/", "/polls", "/posts/123"),
        fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => /^[a-zA-Z0-9]+$/.test(s)),
        fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => /^[a-zA-Z0-9]+$/.test(s)),
        async (basePath, paramKey, paramValue) => {
          // Clean up before each property test iteration
          cleanup();
          sessionStorage.clear();

          const pathWithQuery = `${basePath}?${paramKey}=${paramValue}`;

          // Render with unauthenticated state
          renderWithProviders(pathWithQuery, false, true);

          // Should redirect to login
          await waitFor(() => {
            const loginPages = screen.queryAllByTestId("login-page");
            expect(loginPages.length).toBeGreaterThan(0);
          });

          // Should save full path including query params
          const savedPath = sessionStorage.getItem("redirectAfterLogin");
          expect(savedPath).toBe(pathWithQuery);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("should consistently block access for unauthenticated state regardless of route complexity", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various route patterns
        fc.record({
          base: fc.constantFrom("/", "/profile", "/posts"),
          param: fc.option(
            fc
              .string({ minLength: 1, maxLength: 10 })
              .filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
            {
              nil: null,
            },
          ),
          subpath: fc.option(fc.constantFrom("/edit", "/view", "/settings"), {
            nil: null,
          }),
        }),
        async ({ base, param, subpath }) => {
          // Clean up before each property test iteration
          cleanup();
          sessionStorage.clear();

          let path = base;
          if (param) path += `/${param}`;
          if (subpath) path += subpath;

          // Render with unauthenticated state
          renderWithProviders(path, false, true);

          // Should ALWAYS redirect to login, regardless of route complexity
          await waitFor(() => {
            const loginPages = screen.queryAllByTestId("login-page");
            expect(loginPages.length).toBeGreaterThan(0);
          });

          expect(
            screen.queryByTestId("protected-content"),
          ).not.toBeInTheDocument();
        },
      ),
      { numRuns: 30 },
    );
  });
});


