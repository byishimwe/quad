import { useCallback, useEffect, useState } from "react";

import type { NavigateFunction } from "react-router-dom";

import type { ProfileTab } from "@/components/profile/ProfileTabs";
import { BookmarkService } from "@/services/bookmarkService";
import { FollowService } from "@/services/followService";
import { useFollowStore } from "@/stores/followStore";
import { PollService } from "@/services/pollService";
import { PostService } from "@/services/postService";
import { ProfileService } from "@/services/profileService";
import { StoryService } from "@/services/storyService";
import type { ApiProfile } from "@/types/api";
import type { Poll } from "@/types/poll";
import type { Post } from "@/types/post";
import type { Story } from "@/types/story";
import {
  logError,
  showErrorToast,
  showSuccessToast,
} from "@/lib/errorHandling";
import { useSocketStore } from "@/stores/socketStore";
import type {
  FeedEngagementUpdatePayload,
  PollVotedPayload,
} from "@/lib/socket";

type AuthUser = {
  clerkId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  bio?: string;
};

type SetAuthUser = (user: AuthUser) => void;

type SavedTab = "posts" | "stories" | "polls";

type UseProfilePageControllerArgs = {
  username?: string;
  navigate: NavigateFunction;
  currentUser: AuthUser | null;
  authLoading: boolean;
  setAuthUser: SetAuthUser;
};

export function useProfilePageController({
  username,
  navigate,
  currentUser,
  authLoading,
  setAuthUser,
}: UseProfilePageControllerArgs) {
  const socket = useSocketStore((state) => state.socket);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [savedTab, setSavedTab] = useState<SavedTab>("posts");
  const [user, setUser] = useState<ApiProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [bookmarksCount, setBookmarksCount] = useState(0);

  const follow = useFollowStore((s) => s.follow);
  const unfollow = useFollowStore((s) => s.unfollow);
  const hydrateCounts = useFollowStore((s) => s.hydrateCounts);
  const syncRelationshipFromServer = useFollowStore(
    (s) => s.syncRelationshipFromServer,
  );

  const isFollowing = useFollowStore((s) => {
    const targetId = user?.clerkId;
    if (!targetId) return false;
    return s.isFollowingByTarget[targetId] ?? false;
  });

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postsPage, setPostsPage] = useState(1);
  const [postsHasMore, setPostsHasMore] = useState(false);

  const [stories, setStories] = useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [storiesPage, setStoriesPage] = useState(1);
  const [storiesHasMore, setStoriesHasMore] = useState(false);

  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [pollsError, setPollsError] = useState<string | null>(null);
  const [pollsPage, setPollsPage] = useState(1);
  const [pollsHasMore, setPollsHasMore] = useState(false);

  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedPostsLoading, setSavedPostsLoading] = useState(false);
  const [savedPostsError, setSavedPostsError] = useState<string | null>(null);
  const [savedPostsPage, setSavedPostsPage] = useState(1);
  const [savedPostsHasMore, setSavedPostsHasMore] = useState(false);

  const [savedStories, setSavedStories] = useState<Story[]>([]);
  const [savedStoriesLoading, setSavedStoriesLoading] = useState(false);
  const [savedStoriesError, setSavedStoriesError] = useState<string | null>(
    null,
  );
  const [savedStoriesPage, setSavedStoriesPage] = useState(1);
  const [savedStoriesHasMore, setSavedStoriesHasMore] = useState(false);

  const [savedPolls, setSavedPolls] = useState<Poll[]>([]);
  const [savedPollsLoading, setSavedPollsLoading] = useState(false);
  const [savedPollsError, setSavedPollsError] = useState<string | null>(null);
  const [savedPollsPage, setSavedPollsPage] = useState(1);
  const [savedPollsHasMore, setSavedPollsHasMore] = useState(false);

  // Check if this is the current user's profile
  const isOwnProfile = currentUser?.username === username;

  const selectActiveTab = (tab: ProfileTab) => {
    if (tab === "saved") setSavedTab("posts");
    setActiveTab(tab);
  };

  // Real API calls to fetch profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!username || authLoading) return;

      setLoading(true);
      setError(null);
      setIsNotFound(false);

      try {
        let profileData: ApiProfile | null = null;

        try {
          profileData = await ProfileService.getProfileByUsername(username);
        } catch (err: unknown) {
          let status: number | undefined;

          if (
            typeof err === "object" &&
            err !== null &&
            "response" in err &&
            typeof (err as { response?: { status?: number } }).response
              ?.status === "number"
          ) {
            status = (err as { response?: { status?: number } }).response
              ?.status;
          }

          if (status === 404 && currentUser?.clerkId) {
            profileData = await ProfileService.getProfileById(
              currentUser.clerkId,
            );

            if (profileData?.username && profileData.username !== username) {
              navigate(`/profile/${profileData.username}`, {
                replace: true,
              });
            }
          } else {
            throw err;
          }
        }

        if (!profileData) {
          setIsNotFound(true);
          setError("This profile does not exist or is no longer available.");
          return;
        }

        try {
          const followStats = await FollowService.getFollowStats(
            profileData.clerkId,
          );
          profileData = {
            ...profileData,
            followersCount: followStats.followersCount,
            followingCount: followStats.followingCount,
          };

          hydrateCounts(profileData.clerkId, {
            followersCount: followStats.followersCount,
            followingCount: followStats.followingCount,
          });
          if (!isOwnProfile && typeof followStats.isFollowing === "boolean") {
            syncRelationshipFromServer(profileData.clerkId, followStats.isFollowing);
          }
        } catch (statsError) {
          logError(statsError, {
            component: "ProfilePage",
            action: "getFollowStats",
            metadata: { profileClerkId: profileData.clerkId },
          });
        }

        setUser(profileData);

        // Stats already includes the follow relationship. Avoid a separate,
        // potentially stale request that could hide an otherwise valid profile.
      } catch (err: unknown) {
        let status: number | undefined;

        if (
          typeof err === "object" &&
          err !== null &&
          "response" in err &&
          typeof (err as { response?: { status?: number } }).response
            ?.status === "number"
        ) {
          status = (err as { response?: { status?: number } }).response?.status;
        }

        if (status === 404) {
          setIsNotFound(true);
          setError("This profile does not exist or is no longer available.");
        } else {
          setIsNotFound(false);
          setError(
            "Something went wrong while loading this profile. Please try again.",
          );
        }
      } finally {
        setLoading(false);
      }
    };

    if (username && !authLoading) {
      void fetchProfileData();
    }
  }, [
    username,
    authLoading,
    currentUser?.clerkId,
    navigate,
    isOwnProfile,
    hydrateCounts,
    syncRelationshipFromServer,
  ]);

  useEffect(() => {
    if (!isOwnProfile || authLoading) {
      // Clear a previous account's count when switching profile ownership.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBookmarksCount(0);
      return;
    }

    const fetchBookmarksCount = async () => {
      try {
        const res = await BookmarkService.list({ page: 1, limit: 1 });
        setBookmarksCount(res.pagination?.total ?? 0);
      } catch (err) {
        logError(err, {
          component: "ProfilePage",
          action: "getBookmarksCount",
        });
        setBookmarksCount(0);
      }
    };

    void fetchBookmarksCount();
  }, [authLoading, isOwnProfile]);

  useEffect(() => {
    if (!username || authLoading) return;

    if (activeTab !== "posts") return;

    let cancelled = false;

    const fetchPosts = async () => {
      try {
        setPostsLoading(true);
        setPostsError(null);
        setPosts([]);
        setPostsPage(1);
        setPostsHasMore(false);

        const res = await ProfileService.getUserPostsAsPosts(username, {
          page: 1,
          limit: 20,
        });

        if (cancelled) return;

        setPosts(res.posts);
        setPostsPage(1);
        setPostsHasMore(Boolean(res.hasMore));
      } catch (e) {
        logError(e, {
          component: "ProfilePage",
          action: "getUserPostsAsPosts",
          metadata: { username },
        });

        if (!cancelled) {
          setPostsError("Failed to load posts");
          setPosts([]);
          setPostsHasMore(false);
        }
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    };

    void fetchPosts();

    return () => {
      cancelled = true;
    };
  }, [activeTab, authLoading, username]);

  useEffect(() => {
    if (!isOwnProfile || authLoading) return;
    if (activeTab !== "saved" || savedTab !== "posts") return;

    let cancelled = false;

    const fetchSavedPosts = async () => {
      try {
        setSavedPostsLoading(true);
        setSavedPostsError(null);
        setSavedPosts([]);
        setSavedPostsPage(1);
        setSavedPostsHasMore(false);

        const res = await BookmarkService.list({
          page: 1,
          limit: 20,
          contentType: "post",
        });

        const ids = (res.data || []).map((b) => b.contentId).filter(Boolean);
        const posts = await Promise.all(
          ids.map(async (id) => {
            try {
              const r = await PostService.getPostById(id);
              return r.success ? r.data : null;
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;

        setSavedPosts(posts.filter((p): p is Post => Boolean(p)));
        setSavedPostsPage(1);
        setSavedPostsHasMore(Boolean(res.pagination?.hasMore));
      } catch (e) {
        logError(e, {
          component: "ProfilePage",
          action: "bookmarks.posts",
        });

        if (!cancelled) {
          setSavedPostsError("Failed to load bookmarks");
          setSavedPosts([]);
          setSavedPostsHasMore(false);
        }
      } finally {
        if (!cancelled) setSavedPostsLoading(false);
      }
    };

    void fetchSavedPosts();

    return () => {
      cancelled = true;
    };
  }, [activeTab, authLoading, isOwnProfile, savedTab]);

  useEffect(() => {
    if (!isOwnProfile || authLoading) return;
    if (activeTab !== "saved" || savedTab !== "stories") return;

    let cancelled = false;

    const fetchSavedStories = async () => {
      try {
        setSavedStoriesLoading(true);
        setSavedStoriesError(null);
        setSavedStories([]);
        setSavedStoriesPage(1);
        setSavedStoriesHasMore(false);

        const res = await BookmarkService.list({
          page: 1,
          limit: 20,
          contentType: "story",
        });

        const ids = (res.data || []).map((b) => b.contentId).filter(Boolean);
        const stories = await Promise.all(
          ids.map(async (id) => {
            try {
              const r = await StoryService.getById(id);
              return r.success ? (r.data ?? null) : null;
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;

        setSavedStories(stories.filter((s): s is Story => Boolean(s)));
        setSavedStoriesPage(1);
        setSavedStoriesHasMore(Boolean(res.pagination?.hasMore));
      } catch (e) {
        logError(e, {
          component: "ProfilePage",
          action: "bookmarks.stories",
        });

        if (!cancelled) {
          setSavedStoriesError("Failed to load bookmarks");
          setSavedStories([]);
          setSavedStoriesHasMore(false);
        }
      } finally {
        if (!cancelled) setSavedStoriesLoading(false);
      }
    };

    void fetchSavedStories();

    return () => {
      cancelled = true;
    };
  }, [activeTab, authLoading, isOwnProfile, savedTab]);

  useEffect(() => {
    if (!isOwnProfile || authLoading) return;
    if (activeTab !== "saved" || savedTab !== "polls") return;

    let cancelled = false;

    const fetchSavedPolls = async () => {
      try {
        setSavedPollsLoading(true);
        setSavedPollsError(null);
        setSavedPolls([]);
        setSavedPollsPage(1);
        setSavedPollsHasMore(false);

        const res = await BookmarkService.list({
          page: 1,
          limit: 20,
          contentType: "poll",
        });

        const ids = (res.data || []).map((b) => b.contentId).filter(Boolean);
        const pollsRes = await Promise.all(
          ids.map(async (id) => {
            try {
              const r = await PollService.getById(id);
              return r.success ? (r.data ?? null) : null;
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;

        setSavedPolls(pollsRes.filter((p): p is Poll => Boolean(p)));
        setSavedPollsPage(1);
        setSavedPollsHasMore(Boolean(res.pagination?.hasMore));
      } catch (e) {
        logError(e, {
          component: "ProfilePage",
          action: "bookmarks.polls",
        });

        if (!cancelled) {
          setSavedPollsError("Failed to load bookmarks");
          setSavedPolls([]);
          setSavedPollsHasMore(false);
        }
      } finally {
        if (!cancelled) setSavedPollsLoading(false);
      }
    };

    void fetchSavedPolls();

    return () => {
      cancelled = true;
    };
  }, [activeTab, authLoading, isOwnProfile, savedTab]);

  useEffect(() => {
    if (!username || authLoading) return;

    if (activeTab !== "polls") return;

    let cancelled = false;

    const fetchPolls = async () => {
      try {
        setPollsLoading(true);
        setPollsError(null);
        setPolls([]);
        setPollsPage(1);
        setPollsHasMore(false);

        const res = await ProfileService.getUserPollsAsPolls(username, {
          page: 1,
          limit: 10,
        });

        if (cancelled) return;

        setPolls(res.polls);
        setPollsPage(1);
        setPollsHasMore(Boolean(res.hasMore));
      } catch (e) {
        logError(e, {
          component: "ProfilePage",
          action: "getUserPollsAsPolls",
          metadata: { username },
        });

        if (!cancelled) {
          setPollsError("Failed to load polls");
          setPolls([]);
          setPollsHasMore(false);
        }
      } finally {
        if (!cancelled) setPollsLoading(false);
      }
    };

    void fetchPolls();

    return () => {
      cancelled = true;
    };
  }, [activeTab, authLoading, username]);

  useEffect(() => {
    if (!username || authLoading) return;

    if (activeTab !== "stories") return;

    let cancelled = false;

    const fetchStories = async () => {
      try {
        setStoriesLoading(true);
        setStoriesError(null);
        setStories([]);
        setStoriesPage(1);
        setStoriesHasMore(false);

        const res = await ProfileService.getUserStoriesAsStories(username, {
          page: 1,
          limit: 20,
        });

        if (cancelled) return;

        setStories(res.stories);
        setStoriesPage(1);
        setStoriesHasMore(Boolean(res.hasMore));
      } catch (e) {
        logError(e, {
          component: "ProfilePage",
          action: "getUserStoriesAsStories",
          metadata: { username },
        });

        if (!cancelled) {
          setStoriesError("Failed to load stories");
          setStories([]);
          setStoriesHasMore(false);
        }
      } finally {
        if (!cancelled) setStoriesLoading(false);
      }
    };

    void fetchStories();

    return () => {
      cancelled = true;
    };
  }, [activeTab, authLoading, username]);

  const handleLoadMorePosts = useCallback(async () => {
    if (!username) return;
    if (activeTab !== "posts") return;
    if (postsLoading || !postsHasMore) return;

    try {
      setPostsLoading(true);
      setPostsError(null);

      const nextPage = postsPage + 1;
      const res = await ProfileService.getUserPostsAsPosts(username, {
        page: nextPage,
        limit: 20,
      });

      setPosts((prev) => [...prev, ...res.posts]);
      setPostsPage(nextPage);
      setPostsHasMore(Boolean(res.hasMore));
    } catch (e) {
      logError(e, {
        component: "ProfilePage",
        action: "getUserPostsAsPosts.loadMore",
        metadata: { username, postsPage },
      });
      setPostsError("Failed to load more posts");
    } finally {
      setPostsLoading(false);
    }
  }, [activeTab, postsHasMore, postsLoading, postsPage, username]);

  const handleLoadMoreStories = useCallback(async () => {
    if (!username) return;
    if (activeTab !== "stories") return;
    if (storiesLoading || !storiesHasMore) return;

    try {
      setStoriesLoading(true);
      setStoriesError(null);

      const nextPage = storiesPage + 1;
      const res = await ProfileService.getUserStoriesAsStories(username, {
        page: nextPage,
        limit: 20,
      });

      setStories((prev) => [...prev, ...res.stories]);
      setStoriesPage(nextPage);
      setStoriesHasMore(Boolean(res.hasMore));
    } catch (e) {
      logError(e, {
        component: "ProfilePage",
        action: "getUserStoriesAsStories.loadMore",
        metadata: { username, storiesPage },
      });
      setStoriesError("Failed to load more stories");
    } finally {
      setStoriesLoading(false);
    }
  }, [activeTab, storiesHasMore, storiesLoading, storiesPage, username]);

  const handleLoadMorePolls = useCallback(async () => {
    if (!username) return;
    if (activeTab !== "polls") return;
    if (pollsLoading || !pollsHasMore) return;

    try {
      setPollsLoading(true);
      setPollsError(null);

      const nextPage = pollsPage + 1;
      const res = await ProfileService.getUserPollsAsPolls(username, {
        page: nextPage,
        limit: 10,
      });

      setPolls((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newOnes = res.polls.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newOnes];
      });
      setPollsPage(nextPage);
      setPollsHasMore(Boolean(res.hasMore));
    } catch (e) {
      logError(e, {
        component: "ProfilePage",
        action: "getUserPollsAsPolls.loadMore",
        metadata: { username, pollsPage },
      });
      setPollsError("Failed to load more polls");
    } finally {
      setPollsLoading(false);
    }
  }, [activeTab, pollsHasMore, pollsLoading, pollsPage, username]);

  const handleLoadMoreSavedPosts = useCallback(async () => {
    if (activeTab !== "saved" || savedTab !== "posts") return;
    if (savedPostsLoading || !savedPostsHasMore) return;

    try {
      setSavedPostsLoading(true);
      setSavedPostsError(null);

      const nextPage = savedPostsPage + 1;
      const res = await BookmarkService.list({
        page: nextPage,
        limit: 20,
        contentType: "post",
      });

      const ids = (res.data || []).map((b) => b.contentId).filter(Boolean);
      const posts = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await PostService.getPostById(id);
            return r.success ? r.data : null;
          } catch {
            return null;
          }
        }),
      );

      const resolved = posts.filter((p): p is Post => Boolean(p));
      setSavedPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p._id));
        const newOnes = resolved.filter((p) => !existingIds.has(p._id));
        return [...prev, ...newOnes];
      });
      setSavedPostsPage(nextPage);
      setSavedPostsHasMore(Boolean(res.pagination?.hasMore));
    } catch (e) {
      logError(e, {
        component: "ProfilePage",
        action: "bookmarks.posts.loadMore",
        metadata: { savedPostsPage },
      });
      setSavedPostsError("Failed to load more bookmarks");
    } finally {
      setSavedPostsLoading(false);
    }
  }, [
    activeTab,
    savedPostsHasMore,
    savedPostsLoading,
    savedPostsPage,
    savedTab,
  ]);

  const handleLoadMoreSavedStories = useCallback(async () => {
    if (activeTab !== "saved" || savedTab !== "stories") return;
    if (savedStoriesLoading || !savedStoriesHasMore) return;

    try {
      setSavedStoriesLoading(true);
      setSavedStoriesError(null);

      const nextPage = savedStoriesPage + 1;
      const res = await BookmarkService.list({
        page: nextPage,
        limit: 20,
        contentType: "story",
      });

      const ids = (res.data || []).map((b) => b.contentId).filter(Boolean);
      const stories = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await StoryService.getById(id);
            return r.success ? (r.data ?? null) : null;
          } catch {
            return null;
          }
        }),
      );

      const resolved = stories.filter((s): s is Story => Boolean(s));
      setSavedStories((prev) => {
        const existingIds = new Set(prev.map((s) => s._id));
        const newOnes = resolved.filter((s) => !existingIds.has(s._id));
        return [...prev, ...newOnes];
      });
      setSavedStoriesPage(nextPage);
      setSavedStoriesHasMore(Boolean(res.pagination?.hasMore));
    } catch (e) {
      logError(e, {
        component: "ProfilePage",
        action: "bookmarks.stories.loadMore",
        metadata: { savedStoriesPage },
      });
      setSavedStoriesError("Failed to load more bookmarks");
    } finally {
      setSavedStoriesLoading(false);
    }
  }, [
    activeTab,
    savedStoriesHasMore,
    savedStoriesLoading,
    savedStoriesPage,
    savedTab,
  ]);

  const handleLoadMoreSavedPolls = useCallback(async () => {
    if (activeTab !== "saved" || savedTab !== "polls") return;
    if (savedPollsLoading || !savedPollsHasMore) return;

    try {
      setSavedPollsLoading(true);
      setSavedPollsError(null);

      const nextPage = savedPollsPage + 1;
      const res = await BookmarkService.list({
        page: nextPage,
        limit: 20,
        contentType: "poll",
      });

      const ids = (res.data || []).map((b) => b.contentId).filter(Boolean);
      const pollsRes = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await PollService.getById(id);
            return r.success ? (r.data ?? null) : null;
          } catch {
            return null;
          }
        }),
      );

      const resolved = pollsRes.filter((p): p is Poll => Boolean(p));
      setSavedPolls((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newOnes = resolved.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newOnes];
      });
      setSavedPollsPage(nextPage);
      setSavedPollsHasMore(Boolean(res.pagination?.hasMore));
    } catch (e) {
      logError(e, {
        component: "ProfilePage",
        action: "bookmarks.polls.loadMore",
        metadata: { savedPollsPage },
      });
      setSavedPollsError("Failed to load more bookmarks");
    } finally {
      setSavedPollsLoading(false);
    }
  }, [
    activeTab,
    savedPollsHasMore,
    savedPollsLoading,
    savedPollsPage,
    savedTab,
  ]);

  const handleDeletePost = useCallback(async (postId: string) => {
    try {
      const res = await PostService.deletePost(postId);

      if (!res?.success) {
        showErrorToast(res?.message || "Failed to delete post");
        return;
      }

      setPosts((prev) => prev.filter((p) => p._id !== postId));
      setUser((prev) =>
        prev
          ? {
              ...prev,
              postsCount: Math.max((prev.postsCount ?? 0) - 1, 0),
            }
          : prev,
      );

      showSuccessToast("Post deleted");
    } catch (e) {
      logError(e, {
        component: "ProfilePage",
        action: "deletePost",
        metadata: { postId },
      });
      showErrorToast("Failed to delete post");
    }
  }, []);

  const handlePollUpdate = useCallback((updatedPoll: Poll) => {
    setPolls((prev) =>
      prev.map((p) => (p.id === updatedPoll.id ? updatedPoll : p)),
    );
  }, []);

  const handleSavedPollUpdate = useCallback((updatedPoll: Poll) => {
    setSavedPolls((prev) =>
      prev.map((p) => (p.id === updatedPoll.id ? updatedPoll : p)),
    );
  }, []);

  const handleDeleteSavedPoll = useCallback(async (pollId: string) => {
    try {
      const res = await PollService.delete(pollId);

      if (!res?.success) {
        showErrorToast(res?.message || "Failed to delete poll");
        return;
      }

      setSavedPolls((prev) => prev.filter((p) => p.id !== pollId));
      setUser((prev) =>
        prev
          ? {
              ...prev,
              pollsCount: Math.max((prev.pollsCount ?? 0) - 1, 0),
            }
          : prev,
      );

      showSuccessToast("Poll deleted");
    } catch (e) {
      logError(e, {
        component: "ProfilePage",
        action: "deleteSavedPoll",
        metadata: { pollId },
      });
      showErrorToast("Failed to delete poll");
    }
  }, []);

  const handleDeletePoll = useCallback(async (pollId: string) => {
    try {
      const res = await PollService.delete(pollId);

      if (!res?.success) {
        showErrorToast(res?.message || "Failed to delete poll");
        return;
      }

      setPolls((prev) => prev.filter((p) => p.id !== pollId));
      setUser((prev) =>
        prev
          ? {
              ...prev,
              pollsCount: Math.max((prev.pollsCount ?? 0) - 1, 0),
            }
          : prev,
      );

      showSuccessToast("Poll deleted");
    } catch (e) {
      logError(e, {
        component: "ProfilePage",
        action: "deletePoll",
        metadata: { pollId },
      });
      showErrorToast("Failed to delete poll");
    }
  }, []);

  const handleDeleteStory = useCallback(async (storyId: string) => {
    try {
      const res = await StoryService.delete(storyId);

      if (!res?.success) {
        showErrorToast(res?.message || "Failed to delete story");
        return;
      }

      setStories((prev) => prev.filter((s) => s._id !== storyId));
      setUser((prev) =>
        prev
          ? {
              ...prev,
              storiesCount: Math.max((prev.storiesCount ?? 0) - 1, 0),
            }
          : prev,
      );

      showSuccessToast("Story deleted");
    } catch (e) {
      logError(e, {
        component: "ProfilePage",
        action: "deleteStory",
        metadata: { storyId },
      });
      showErrorToast("Failed to delete story");
    }
  }, []);

  // Handle follow/unfollow
  const handleFollow = useCallback(async () => {
    if (!user) return;

    try {
      await follow(user.clerkId);
    } catch (err) {
      logError(err, {
        component: "ProfilePage",
        action: "followUser",
        metadata: { targetClerkId: user.clerkId },
      });
      showErrorToast(err);
    }
  }, [user, follow]);

  const handleUnfollow = useCallback(async () => {
    if (!user) return;

    try {
      await unfollow(user.clerkId);
    } catch (err) {
      logError(err, {
        component: "ProfilePage",
        action: "unfollowUser",
        metadata: { targetClerkId: user.clerkId },
      });
      showErrorToast(err);
    }
  }, [user, unfollow]);

  const handleEditProfile = useCallback(() => {
    // no-op
  }, []);

  const handleUserUpdate = useCallback(
    (updatedUser: Partial<ApiProfile>) => {
      setUser((prev) =>
        prev ? ({ ...prev, ...updatedUser } as ApiProfile) : prev,
      );

      if (
        isOwnProfile &&
        updatedUser.username &&
        updatedUser.username !== username
      ) {
        if (currentUser) {
          setAuthUser({
            ...currentUser,
            username: updatedUser.username,
            firstName: updatedUser.firstName ?? currentUser.firstName,
            lastName: updatedUser.lastName ?? currentUser.lastName,
            profileImage: updatedUser.profileImage ?? currentUser.profileImage,
            bio: updatedUser.bio ?? currentUser.bio,
          });
        }

        navigate(`/profile/${updatedUser.username}`, { replace: true });
      }
    },
    [currentUser, isOwnProfile, navigate, setAuthUser, username],
  );

  // Set up Socket.IO listeners for real-time poll updates
  useEffect(() => {
    if (!socket) return;

    const handleEngagementUpdate = (payload: FeedEngagementUpdatePayload) => {
      if (payload.contentType === "poll") {
        // Update polls in the main polls tab
        setPolls((prevPolls) =>
          prevPolls.map((poll) => {
            if (poll.id === payload.contentId) {
              return {
                ...poll,
                totalVotes: payload.votes ?? poll.totalVotes,
                reactionsCount: payload.reactionsCount ?? poll.reactionsCount,
              };
            }
            return poll;
          }),
        );

        // Update saved polls if they're visible
        setSavedPolls((prevPolls) =>
          prevPolls.map((poll) => {
            if (poll.id === payload.contentId) {
              return {
                ...poll,
                totalVotes: payload.votes ?? poll.totalVotes,
                reactionsCount: payload.reactionsCount ?? poll.reactionsCount,
              };
            }
            return poll;
          }),
        );
      }
    };

    const handlePollVoted = (payload: PollVotedPayload) => {
      if (!payload?.pollId) return;

      const updatePollVotes = (polls: Poll[]) =>
        polls.map((poll) => {
          if (String(poll.id) !== String(payload.pollId)) return poll;

          const totalVotes =
            typeof payload.totalVotes === "number"
              ? payload.totalVotes
              : poll.totalVotes;

          const options = poll.options.map((opt, idx) => {
            const optionIndex = typeof opt.index === "number" ? opt.index : idx;
            const votesCountRaw = payload.updatedVoteCounts?.[optionIndex];
            const votesCount =
              typeof votesCountRaw === "number"
                ? votesCountRaw
                : (opt.votesCount ?? 0);

            return {
              ...opt,
              votesCount,
              percentage:
                totalVotes > 0
                  ? Math.round((votesCount / totalVotes) * 100)
                  : 0,
            };
          });

          return {
            ...poll,
            totalVotes,
            options,
          };
        });

      // Update both main polls and saved polls
      setPolls(updatePollVotes);
      setSavedPolls(updatePollVotes);
    };

    const handlePollExpired = (pollId: string) => {
      const updatePollStatus = (polls: Poll[]) =>
        polls.map((poll) => {
          if (poll.id !== pollId) return poll;
          return {
            ...poll,
            status: "expired" as const,
          };
        });

      // Update both main polls and saved polls
      setPolls(updatePollStatus);
      setSavedPolls(updatePollStatus);
    };

    socket.on("feed:engagement-update", handleEngagementUpdate);
    socket.on("pollVoted", handlePollVoted);
    socket.on("pollExpired", handlePollExpired);

    return () => {
      socket.off("feed:engagement-update", handleEngagementUpdate);
      socket.off("pollVoted", handlePollVoted);
      socket.off("pollExpired", handlePollExpired);
    };
  }, [socket]);

  return {
    activeTab,
    setActiveTab: selectActiveTab,
    savedTab,
    setSavedTab,
    user,
    loading,
    error,
    isNotFound,
    isFollowing,
    isOwnProfile,
    bookmarksCount,
    posts,
    postsLoading,
    postsError,
    postsHasMore,
    handleLoadMorePosts,
    handleDeletePost,
    stories,
    storiesLoading,
    storiesError,
    storiesHasMore,
    handleLoadMoreStories,
    handleDeleteStory,
    polls,
    pollsLoading,
    pollsError,
    pollsHasMore,
    handleLoadMorePolls,
    handlePollUpdate,
    handleDeletePoll,
    handleDeleteSavedPoll,
    handleSavedPollUpdate,
    savedPosts,
    savedPostsLoading,
    savedPostsError,
    savedPostsHasMore,
    handleLoadMoreSavedPosts,
    savedStories,
    savedStoriesLoading,
    savedStoriesError,
    savedStoriesHasMore,
    handleLoadMoreSavedStories,
    savedPolls,
    savedPollsLoading,
    savedPollsError,
    savedPollsHasMore,
    handleLoadMoreSavedPolls,
    handleFollow,
    handleUnfollow,
    handleEditProfile,
    handleUserUpdate,
  };
}

