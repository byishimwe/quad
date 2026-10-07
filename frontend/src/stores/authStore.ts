import { create } from "zustand";
import { requestCache } from "@/lib/requestCache";
import { rateLimitState } from "@/lib/api/rateLimitState";

// Clerk user object interface - based on actual Clerk user structure
interface ClerkUserObject {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string;
  emailAddresses?: Array<{
    emailAddress: string;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

interface User {
  _id: string;
  clerkId: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  coverImage?: string;
  bio?: string;
  isVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  syncWithClerk: (clerkUser: unknown | null) => void;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
    (set, get) => ({
      user: null,
      isLoading: true,
      error: null,

      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      syncWithClerk: (clerkUser) => {
        if (clerkUser && typeof clerkUser === "object") {
          const user = clerkUser as ClerkUserObject;
          if (get().user?.clerkId !== user.id) {
            requestCache.clear();
            rateLimitState.clear();
          }
          const userData: User = {
            _id: "", // Will be set after backend sync
            clerkId: user.id || "",
            username:
              user.username ||
              user.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
              "",
            email: user.emailAddresses?.[0]?.emailAddress || "",
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            profileImage: user.imageUrl || "",
            bio: "",
            isVerified: false, // Will be set from backend user data
            createdAt:
              user.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt:
              user.updatedAt?.toISOString() || new Date().toISOString(),
          };

          set({
            user: userData,
            isLoading: false,
            error: null,
          });
        } else {
          set({ user: null });
        }
      },

      logout: () => {
        requestCache.clear();
        rateLimitState.clear();
        set({
          user: null,
          isLoading: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
    })
);
