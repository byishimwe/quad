import { useAuth, useUser } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";
import { type ReactNode, useMemo } from "react";
import { MainAppSkeleton } from "@/components/ui/loading";
import type { PermissionType } from "@/lib/security";
import { hasAllPermissions } from "@/lib/security";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: PermissionType[];
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredPermissions = [],
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const location = useLocation();

  const userPermissions = useMemo((): string[] => {
    const meta = (
      clerkUser as unknown as {
        publicMetadata?: unknown;
        unsafeMetadata?: unknown;
      } | null
    )?.publicMetadata;

    const unsafeMeta = (
      clerkUser as unknown as {
        publicMetadata?: unknown;
        unsafeMetadata?: unknown;
      } | null
    )?.unsafeMetadata;

    const readPermissions = (obj: unknown): string[] | null => {
      if (!obj || typeof obj !== "object") return null;
      const permissions = (obj as { permissions?: unknown }).permissions;
      if (!Array.isArray(permissions)) return null;
      const asStrings = permissions.filter(
        (p): p is string => typeof p === "string",
      );
      return asStrings.length > 0 ? asStrings : [];
    };

    const readRole = (obj: unknown): string | null => {
      if (!obj || typeof obj !== "object") return null;
      const role = (obj as { role?: unknown }).role;
      return typeof role === "string" ? role : null;
    };

    const explicit = readPermissions(meta) ?? readPermissions(unsafeMeta);
    if (explicit) return explicit;

    const role = readRole(meta) ?? readRole(unsafeMeta);
    if (role && role in DEFAULT_PERMISSIONS) {
      return DEFAULT_PERMISSIONS[
        role as keyof typeof DEFAULT_PERMISSIONS
      ].slice();
    }

    return [];
  }, [clerkUser]);

  // Show skeleton while Clerk is initializing
  if (!isLoaded) {
    return <MainAppSkeleton />;
  }

  // Redirect to login if not authenticated
  if (!isSignedIn) {
    // Preserve intended destination for redirect after login
    sessionStorage.setItem(
      "redirectAfterLogin",
      location.pathname + location.search,
    );

    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (requiredPermissions.length > 0) {
    const allowed = hasAllPermissions(userPermissions, requiredPermissions);

    if (!allowed) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center space-y-4 max-w-md p-6">
            <h1 className="text-xl font-semibold">Access denied</h1>
            <p className="text-muted-foreground">
              You don’t have permission to view this page.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
