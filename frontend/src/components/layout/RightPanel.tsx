import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  PiBookOpenTextBold,
  PiFileTextBold,
  PiChatCircleBold,
  PiChartBarBold,
  PiSignOutBold,
  PiWarningCircleBold,
  PiSealCheckBold,
} from "react-icons/pi";
import { useAuth } from "@clerk/clerk-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import { cn } from "@/lib/utils";
import { logError } from "@/lib/errorHandling";
import { useAuthStore } from "@/stores/authStore";
import { ChatService } from "@/services/chatService";
import type { ChatAuthor } from "@/types/chat";
import { SkeletonAvatar } from "@/components/ui/loading";

export function RightPanel() {
  return (
    <aside className="h-full bg-sidebar border-l border-border/40 flex flex-col overflow-hidden">
      <div className="flex flex-col gap-6 p-6 flex-1 min-h-0">
        <QuickCreate />
        <ActiveChatsMini />
        <div className="mt-auto flex flex-col gap-4">
          <div className="rounded-3xl border border-border/40 bg-card/50 overflow-hidden">
            <ThemeSelector />
          </div>
          <AccountMiniCard />
        </div>
      </div>
    </aside>
  );
}

function QuickCreate() {
  const navigate = useNavigate();
  const location = useLocation();

  const handlePostClick = () => {
    if (location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.dispatchEvent(new CustomEvent("focus-post-composer"));
    } else {
      navigate("/?create=post");
    }
  };

  return (
    <section className="rounded-3xl border border-border/40 bg-card/50 overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Quick Create</h2>
      </div>

      <div className="px-4 pb-4 grid grid-cols-1 gap-2">
        <Button
          onClick={handlePostClick}
          className="w-full justify-start rounded-2xl border shadow-none bg-primary/10 hover:bg-primary/15 border-primary/20 text-foreground h-11">
          <PiFileTextBold className="h-4 w-4 text-primary" />
          Post
        </Button>

        <Button
          asChild
          className="w-full justify-start rounded-2xl border shadow-none bg-primary/10 hover:bg-primary/15 border-primary/20 text-foreground h-11">
          <Link to="/create/poll" aria-label="Create a poll">
            <PiChartBarBold className="h-4 w-4 text-primary" />
            Poll
          </Link>
        </Button>

        <Button
          asChild
          className="w-full justify-start rounded-2xl border shadow-none bg-primary/10 hover:bg-primary/15 border-primary/20 text-foreground h-11">
          <Link to="/create/story" aria-label="Create a story">
            <PiBookOpenTextBold className="h-4 w-4 text-primary" />
            Story
          </Link>
        </Button>
      </div>
    </section>
  );
}

function ActiveChatsMini() {
  const { user } = useAuthStore();
  const [authors, setAuthors] = useState<ChatAuthor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (!user) {
          if (!cancelled) {
            setAuthors([]);
            setLoading(false);
          }
          return;
        }

        setLoading(true);
        const res = await ChatService.getMessages({ limit: 30 });
        if (!res.success || !Array.isArray(res.data)) {
          if (!cancelled) setAuthors([]);
          return;
        }

        const seen = new Set<string>();
        const next: ChatAuthor[] = [];

        for (const msg of res.data) {
          const a = msg?.author;
          if (!a) continue;

          const key = a.clerkId || a.username || a.email;
          if (!key || seen.has(key)) continue;

          seen.add(key);
          next.push(a);
          if (next.length >= 3) break;
        }

        if (!cancelled) setAuthors(next);
      } catch (error) {
        logError(error, { component: "RightPanel", action: "loadChatAuthors" });
        if (!cancelled) setAuthors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const statusLabel = useMemo(() => {
    if (!user) return "Signed out";
    if (loading) return "";
    if (authors.length > 0) return "Recent activity";
    return "No recent chat activity";
  }, [authors.length, loading, user]);

  return (
    <section className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Recent in Chat</h2>
        <span
          className={cn(
            "text-[11px] font-medium",
            "text-muted-foreground",
          )}>
          {statusLabel}
        </span>
      </div>

      <div className="px-4 pb-4">
        {!user && (
          <p className="text-xs text-muted-foreground mb-3">
            Sign in to see recent chat activity
          </p>
        )}

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-background/50 px-3 py-3">
          <div className="flex -space-x-2">
            {authors.length > 0
              ? authors.map((a) => (
                  <div
                    key={a.clerkId || a.username || a.email}
                    className="relative">
                    <Avatar className="h-9 w-9 border-2 border-sidebar">
                      <AvatarImage src={a.profileImage} alt={a.username} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-bold">
                        {(a.username || a.email || "U")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                ))
              : loading && user
                ? [0, 1, 2].map((i) => (
                    <SkeletonAvatar
                      key={i}
                      className={cn(
                        "h-9 w-9 border-2 border-sidebar",
                        i > 0 && "-ml-2",
                      )}
                    />
                  ))
                : [0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-9 w-9 rounded-full border-2 border-sidebar bg-muted/50",
                        i > 0 && "-ml-2",
                      )}
                      aria-hidden="true"
                    />
                  ))}
          </div>

          <Button
            asChild
            size="sm"
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
            <Link to="/chat" aria-label="Open chat" title="Go to chat">
              <PiChatCircleBold className="h-4 w-4" />
              Open Chat
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function AccountMiniCard() {
  const { user, logout } = useAuthStore();
  const { signOut } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.username || "User";

  const profileHref = user?.username ? `/profile/${user.username}` : "/";

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      logout();
      await signOut();
      setIsDialogOpen(false);
    } catch (error) {
      logError(error, { component: "RightPanel", action: "signOut" });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border/40 bg-card/50 p-4">
      <div className="flex items-center gap-3">
        <Link
          to={profileHref}
          aria-label="Go to profile"
          className="flex items-center gap-3 min-w-0 flex-1 rounded-2xl p-2 -m-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar">
          <Avatar className="h-11 w-11 border border-border/40">
            <AvatarImage src={user?.profileImage} alt={displayName} />
            <AvatarFallback className="bg-secondary text-secondary-foreground font-bold">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {displayName}
              </p>
              {user?.isVerified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary shrink-0">
                  <PiSealCheckBold className="h-4 w-4" />
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {user?.username ? `@${user.username}` : user?.email || ""}
            </p>
          </div>
        </Link>

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => !isLoggingOut && setIsDialogOpen(open)}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full text-destructive/90 hover:text-destructive hover:bg-destructive/10 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              aria-label="Log out">
              <PiSignOutBold className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent
            className="bg-card border-border text-card-foreground"
            showClose={!isLoggingOut}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PiWarningCircleBold className="h-5 w-5 text-destructive" />
                Log Out
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                This will end your session on this device. You will need to sign
                in again to continue.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="ghost"
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoggingOut}
                className="text-muted-foreground hover:text-foreground hover:bg-accent">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleSignOut()}
                loading={isLoggingOut}
                disabled={isLoggingOut}
                className="bg-destructive hover:bg-destructive/90 min-w-[100px]">
                {isLoggingOut ? "Logging out..." : "Log Out"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
