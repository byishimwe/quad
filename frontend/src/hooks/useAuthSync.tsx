import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useFollowStore } from "@/stores/followStore";
import { requestCache } from "@/lib/requestCache";
import { rateLimitState } from "@/lib/api/rateLimitState";
import { ProfileService } from "@/services/profileService";
import { logError } from "@/lib/errorHandling";

export function useAuthSync() {
  const { user: clerkUser, isLoaded } = useUser();
  const { sessionId } = useAuth();
  const { syncWithClerk, setLoading, logout } = useAuthStore();
  const previousIdentity = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      setLoading(true);
      return;
    }

    const identity = clerkUser ? `${clerkUser.id}:${sessionId || ""}` : null;
    if (previousIdentity.current !== identity) {
      requestCache.clear();
      rateLimitState.clear();
      useNotificationStore.getState().reset();
      useFollowStore.getState().reset();
      previousIdentity.current = identity;
    }

    if (!clerkUser) {
      logout();
      return;
    }

    // Replace the previous account immediately, before its profile request resolves.
    syncWithClerk(clerkUser);
    let active = true;
    void ProfileService.getProfileById(clerkUser.id)
      .then((profile) => {
        if (!active) return;
        const current = useAuthStore.getState().user;
        if (current?.clerkId !== clerkUser.id) return;
        useAuthStore.getState().setUser({
          ...current,
          _id: profile._id,
          firstName: profile.firstName || current.firstName,
          lastName: profile.lastName || current.lastName,
          profileImage: profile.profileImage || current.profileImage,
          bio: profile.bio || current.bio,
          isVerified: profile.isVerified || current.isVerified,
        });
      })
      .catch((error) => {
        logError(error, { component: "AuthSync", action: "syncProfileOnLogin", userId: clerkUser.id });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [clerkUser, isLoaded, sessionId, setLoading, syncWithClerk, logout]);

  return { isLoaded };
}
