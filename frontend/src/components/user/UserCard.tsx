import { useState } from "react";
import { Link } from "react-router-dom";
import {
  PiCheckCircleBold,
  PiSpinnerBold,
  PiDotsThreeBold,
} from "react-icons/pi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { logError } from "@/lib/errorHandling";
import { useFollowStore } from "@/stores/followStore";
import { useAuthStore } from "@/stores/authStore";

export interface UserCardData {
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
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  joinedAt: string;
  isFollowing?: boolean;
}

interface UserCardProps {
  user: UserCardData;
  onFollow?: (userId: string) => void;
  onUnfollow?: (userId: string) => void;
  showFollowButton?: boolean;
  showBio?: boolean;
  showStats?: boolean;
  compact?: boolean;
  className?: string;
}

export function UserCard({
  user,
  onFollow,
  onUnfollow,
  showFollowButton = true,
  showBio = true,
  showStats = true,
  compact = false,
  className = "",
}: UserCardProps) {
  const currentUserId = useAuthStore((s) => s.user?.clerkId);
  const canShowFollow = showFollowButton && user.clerkId !== currentUserId;
  const [isFollowHovered, setIsFollowHovered] = useState(false);
  const [unfollowConfirmOpen, setUnfollowConfirmOpen] = useState(false);

  const follow = useFollowStore((s) => s.follow);
  const unfollow = useFollowStore((s) => s.unfollow);
  const isFollowingFromStore = useFollowStore(
    (s) => s.isFollowingByTarget[user.clerkId],
  );
  const isPending = useFollowStore((s) => s.pendingByTarget[user.clerkId]);
  const pendingAction = useFollowStore(
    (s) => s.pendingActionByTarget[user.clerkId],
  );

  const isFollowing =
    typeof isFollowingFromStore === "boolean"
      ? isFollowingFromStore
      : Boolean(user.isFollowing);

  const isPendingFollow = Boolean(isPending) && pendingAction === "follow";
  const isPendingUnfollow = Boolean(isPending) && pendingAction === "unfollow";

  const displayName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.username;

  const handleFollowClick = async () => {
    if (isFollowing) {
      setIsFollowHovered(false);
      setUnfollowConfirmOpen(true);
      return;
    }

    try {
      // Prefer centralized store for instant + realtime behavior.
      if (onFollow) {
        await onFollow(user.clerkId);
      } else {
        await follow(user.clerkId);
      }
    } catch (error) {
      logError(error, {
        component: "UserCard",
        action: "follow",
        metadata: { clerkId: user.clerkId, username: user.username },
      });
    }
  };

  const handleConfirmUnfollow = async () => {
    try {
      if (onUnfollow) {
        await onUnfollow(user.clerkId);
      } else {
        await unfollow(user.clerkId);
      }
      setUnfollowConfirmOpen(false);
    } catch (error) {
      logError(error, {
        component: "UserCard",
        action: "unfollow",
        metadata: { clerkId: user.clerkId, username: user.username },
      });
    }
  };

  const getUserInitials = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.username.slice(0, 2).toUpperCase();
  };

  if (compact) {
    return (
      <>
        <div
          className={`group flex items-center gap-3 p-3 transition-colors ${className}`}>
          <Link
            to={`/profile/${user.username}`}
            className="flex items-center gap-3 flex-1 min-w-0 rounded-lg px-1 -mx-1 transition-colors group-hover:bg-muted/0">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.profileImage} alt={displayName} />
              <AvatarFallback className="bg-primary/10">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="font-semibold text-sm truncate">{displayName}</p>
                {user.isVerified && (
                  <PiCheckCircleBold className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </div>
              <p className="text-muted-foreground text-xs truncate">
                @{user.username}
              </p>
            </div>
          </Link>

          {canShowFollow && (
            <Button
              size="sm"
              variant={isFollowing ? "outline" : "default"}
              onClick={handleFollowClick}
              disabled={Boolean(isPending)}
              onMouseEnter={() => setIsFollowHovered(true)}
              onMouseLeave={() => setIsFollowHovered(false)}
              className={
                isFollowing
                  ? "flex-shrink-0 rounded-full px-4 border border-border/70 text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                  : "flex-shrink-0 rounded-full px-4 bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              }>
              {isPendingFollow ? (
                <span className="inline-flex items-center gap-2">
                  <PiSpinnerBold className="h-4 w-4 animate-spin" />
                  Following…
                </span>
              ) : isPendingUnfollow ? (
                "..."
              ) : isFollowing ? (
                isFollowHovered ? (
                  "Unfollow"
                ) : (
                  "Following"
                )
              ) : (
                "Follow"
              )}
            </Button>
          )}
        </div>

        <ConfirmDialog
          open={unfollowConfirmOpen}
          onOpenChange={setUnfollowConfirmOpen}
          title={`Unfollow @${user.username}?`}
          description={`You will stop following @${user.username}.`}
          confirmLabel="Unfollow"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleConfirmUnfollow}
          loading={isPendingUnfollow}
        />
      </>
    );
  }

  return (
    <>
      <Card
        className={`overflow-hidden transition-all duration-200 hover:shadow-md ${className}`}>
        {/* Cover Image */}
        {user.coverImage && (
          <div className="h-20 overflow-hidden">
            <img
              src={user.coverImage}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between">
            <Link
              to={`/profile/${user.username}`}
              className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="h-12 w-12 ring-2 ring-background">
                <AvatarImage src={user.profileImage} alt={displayName} />
                <AvatarFallback className="bg-primary/10">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <h3 className="font-semibold truncate">{displayName}</h3>
                  {user.isVerified && (
                    <PiCheckCircleBold className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </div>
                <p className="text-muted-foreground text-sm truncate">
                  @{user.username}
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {canShowFollow && (
                <Button
                  size="sm"
                  variant={isFollowing ? "outline" : "default"}
                  onClick={handleFollowClick}
                  disabled={Boolean(isPending)}
                  onMouseEnter={() => setIsFollowHovered(true)}
                  onMouseLeave={() => setIsFollowHovered(false)}
                  className={
                    isFollowing
                      ? "rounded-full px-5 border border-border/70 text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                      : "rounded-full px-5 bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
                  }>
                  {isPendingFollow ? (
                    <span className="inline-flex items-center gap-2">
                      <PiSpinnerBold className="h-4 w-4 animate-spin" />
                      Following…
                    </span>
                  ) : isPendingUnfollow ? (
                    "..."
                  ) : isFollowing ? (
                    isFollowHovered ? (
                      "Unfollow"
                    ) : (
                      "Following"
                    )
                  ) : (
                    "Follow"
                  )}
                </Button>
              )}

              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <PiDotsThreeBold className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Bio */}
          {showBio && user.bio && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
              {user.bio}
            </p>
          )}

          {/* Stats */}
          {showStats && (
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <div className="flex gap-1">
                <span className="font-semibold text-foreground">
                  {user.followingCount?.toLocaleString() || 0}
                </span>
                <span>Following</span>
              </div>
              <div className="flex gap-1">
                <span className="font-semibold text-foreground">
                  {user.followersCount?.toLocaleString() || 0}
                </span>
                <span>Followers</span>
              </div>
              {user.postsCount !== undefined && (
                <div className="flex gap-1">
                  <span className="font-semibold text-foreground">
                    {user.postsCount.toLocaleString()}
                  </span>
                  <span>Posts</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={unfollowConfirmOpen}
        onOpenChange={setUnfollowConfirmOpen}
        title={`Unfollow @${user.username}?`}
        description={`You will stop following @${user.username}.`}
        confirmLabel="Unfollow"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmUnfollow}
        loading={isPendingUnfollow}
      />
    </>
  );
}

