import { memo, useEffect } from "react";
import type { RefObject } from "react";
import { Link } from "react-router-dom";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatListSkeleton, ChatLoadingOlderSkeleton } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-message";
import type { ChatMessage } from "@/types/chat";
import {
  PiChatCircleBold,
  PiPencilBold,
  PiTrashBold,
  PiDotsThreeVerticalBold,
} from "react-icons/pi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type MinimalUser = {
  clerkId: string;
  username: string;
  profileImage?: string;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatDayLabel = (d: Date) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (today.getTime() - day.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
};

const formatTimeOnly = (d: Date) =>
  d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

const URL_REGEX =
  /(https?:\/\/(?:www\.)?[\w.-]+(?::[0-9]+)?(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?)/gi;

const linkifyText = (text: string) => {
  const parts = text.split(URL_REGEX);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      return (
        <a
          key={`url-${idx}-${part}`}
          href={part}
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 text-primary hover:text-primary/80 break-words font-medium">
          {part}
        </a>
      );
    }
    return (
      <span key={`txt-${idx}`} className="break-words">
        {part}
      </span>
    );
  });
};

function ChatEmptyState() {
  return (
    <EmptyState
      variant="inline"
      icon={<PiChatCircleBold className="h-8 w-8 text-primary/80" />}
      title="No messages yet"
      description="Say hi to start the conversation. Your message will appear here instantly."
    />
  );
}

function ChatErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorMessage
      title="Couldn't load chat"
      description="Check your connection and try again."
      onRetry={onRetry}
      retryLabel="Retry"
      showGoHome={false}
      className="min-h-0"
    />
  );
}

export type ChatMessageListProps = {
  listRef: RefObject<HTMLDivElement | null>;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  loadingOlder: boolean;
  hasMoreOlder: boolean;
  onLoadOlder: () => void;
  messages: ChatMessage[];
  pendingOutgoingText?: string | null;
  user: MinimalUser | null | undefined;
  onStartEdit: (m: ChatMessage) => void;
  onDeleteMessage: (id: string) => void;
};

export const ChatMessageList = memo(function ChatMessageList({
  listRef,
  loading,
  error,
  onRetry,
  loadingOlder,
  hasMoreOlder,
  onLoadOlder,
  messages,
  pendingOutgoingText,
  user,
  onStartEdit,
  onDeleteMessage,
}: ChatMessageListProps) {
  useEffect(() => {
    const container = listRef.current;
    if (!container || !hasMoreOlder || loadingOlder) return;

    const handleScroll = () => {
      // Load more when scrolled within 200px of the top
      if (container.scrollTop < 200) {
        onLoadOlder();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMoreOlder, loadingOlder, onLoadOlder, listRef]);

  return (
    <>
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-6 py-4">
        {loading && <ChatListSkeleton />}

        {!loading && !pendingOutgoingText && messages.length === 0 && error && (
          <ChatErrorState onRetry={onRetry} />
        )}

        {!loading &&
          !pendingOutgoingText &&
          messages.length === 0 &&
          !error && <ChatEmptyState />}

        {!loading && messages.length > 0 && (
          <div>
            {loadingOlder && <ChatLoadingOlderSkeleton />}

            {messages.map((m, i) => {
              const prev = i > 0 ? messages[i - 1] : undefined;
              const isSelf = m.author.clerkId === user?.clerkId;

              const prevSameAuthor =
                !!prev && prev.author.clerkId === m.author.clerkId;
              const prevSameDay =
                !!prev &&
                isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
              const startsNewGroup = !prevSameAuthor || !prevSameDay;

              const showDaySeparator = i > 0 && !prevSameDay;
              const dayLabel = formatDayLabel(new Date(m.createdAt));

              const showAvatar = startsNewGroup;
              const showHeader = startsNewGroup;
              const showActions = isSelf;

              const bubbleBase =
                "relative w-fit max-w-full break-words px-4 py-2.5 shadow-sm transition-all duration-300 group-hover:shadow-card-hover";
              const bubbleClass = isSelf
                ? cn(
                    bubbleBase,
                    "bg-primary text-primary-foreground shadow-primary/20",
                    startsNewGroup
                      ? "rounded-[1.5rem] rounded-tr-[0.5rem]"
                      : "rounded-[1.5rem]",
                  )
                : cn(
                    bubbleBase,
                    "bg-card text-foreground border border-border/40 hover:border-border/60",
                    startsNewGroup
                      ? "rounded-[1.5rem] rounded-tl-[0.5rem]"
                      : "rounded-[1.5rem]",
                  );

              const headerName = isSelf ? "You" : m.author.username;
              const headerTime = m.isEdited
                ? "edited"
                : formatTimeOnly(new Date(m.createdAt));

              return (
                <div
                  key={m.id}
                  className={cn("py-0", !startsNewGroup && "mt-1.5")}>
                  {showDaySeparator && (
                    <div className="flex items-center justify-center py-3">
                      <div className="h-px flex-1 bg-border/60" />
                      <div className="mx-3 text-[11px] font-medium text-muted-foreground/70 bg-background/70 border border-border/50 px-3 py-1 rounded-full tabular-nums">
                        {dayLabel}
                      </div>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex items-start gap-3",
                      isSelf ? "justify-end" : "justify-start",
                    )}>
                    {!isSelf &&
                      (showAvatar ? (
                        <Link
                          to={`/profile/${m.author.username}`}
                          className="hover:opacity-80 transition-opacity">
                          <Avatar className="h-8 w-8 shrink-0 shadow-sm border border-border/40 hover:scale-105 transition-transform duration-200">
                            <AvatarImage
                              src={m.author.profileImage}
                              alt={m.author.username}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                              {m.author.username?.[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                      ) : (
                        <div className="w-9 shrink-0" />
                      ))}

                    <div
                      className={cn(
                        "flex flex-col max-w-[75%] group min-w-0",
                        isSelf ? "items-end" : "items-start",
                      )}>
                      {showHeader && (
                        <div
                          className={
                            isSelf
                              ? "flex items-center justify-end gap-2 mb-2 w-full"
                              : "flex items-center justify-start gap-2 mb-2 w-full"
                          }>
                          {!isSelf && (
                            <Link
                              to={`/profile/${m.author.username}`}
                              className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                              {headerName}
                            </Link>
                          )}
                          <span className="text-xs text-muted-foreground/60 tabular-nums">
                            {headerTime}
                          </span>
                          {isSelf && (
                            <Link
                              to={`/profile/${user?.username}`}
                              className="text-sm font-bold text-foreground hover:text-primary transition-colors">
                              {headerName}
                            </Link>
                          )}
                        </div>
                      )}

                      <div className="relative group/bubble flex items-center gap-2">
                        {isSelf && showActions && (
                          <div className="opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-200 flex shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/80 text-muted-foreground/60 hover:text-foreground transition-colors"
                                  title="Message options">
                                  <PiDotsThreeVerticalBold className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="min-w-[140px] rounded-xl border border-border bg-popover/95 backdrop-blur-md p-1 shadow-xl animate-in fade-in-0 zoom-in-95">
                                <DropdownMenuItem
                                  onClick={() => onStartEdit(m)}
                                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-accent focus:bg-accent transition-colors">
                                  <PiPencilBold className="h-4 w-4 opacity-70" />
                                  <span>Edit</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onDeleteMessage(m.id)}
                                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 transition-colors">
                                  <PiTrashBold className="h-4 w-4 opacity-70" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}

                        <div className={cn(bubbleClass, "overflow-hidden")}>
                          {m.text && (
                            <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                              {linkifyText(m.text)}
                            </div>
                          )}
                          {!showHeader && (
                            <div
                              className={cn(
                                "text-[10px] mt-1 tabular-nums opacity-0 group-hover/bubble:opacity-60 transition-opacity duration-200",
                                isSelf
                                  ? "text-right text-primary-foreground/80"
                                  : "text-left text-muted-foreground",
                              )}>
                              {formatTimeOnly(new Date(m.createdAt))}
                              {m.isEdited && " • edited"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelf &&
                      (showAvatar ? (
                        <Link
                          to={`/profile/${user?.username}`}
                          className="hover:opacity-80 transition-opacity">
                          <Avatar className="h-8 w-8 shrink-0 shadow-sm border border-primary/20 hover:scale-105 transition-transform duration-200">
                            <AvatarImage
                              src={user?.profileImage}
                              alt={user?.username}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                              {user?.username?.[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                      ) : (
                        <div className="w-9 shrink-0" />
                      ))}
                  </div>
                </div>
              );
            })}

            {!!pendingOutgoingText &&
              (() => {
                const last = messages[messages.length - 1];
                const lastIsSelf = last?.author.clerkId === user?.clerkId;
                const lastSameDay = last
                  ? isSameDay(new Date(last.createdAt), new Date())
                  : false;
                const startsNewGroup = !lastIsSelf || !lastSameDay;

                const showAvatar = startsNewGroup;
                const showHeader = startsNewGroup;
                const bubbleBase =
                  "relative w-fit max-w-full break-words rounded-2xl px-4 py-2.5 shadow-sm transition-all duration-200";

                return (
                  <div
                    className={cn("py-0", !startsNewGroup && "mt-1.5")}
                    aria-live="polite">
                    <div
                      className={cn("flex items-start gap-3", "justify-end")}>
                      <div
                        className={cn(
                          "flex flex-col max-w-[75%] group min-w-0",
                          "items-end",
                        )}>
                        {showHeader && (
                          <div className="flex items-center justify-end gap-2 mb-2 w-full">
                            <span className="text-sm font-semibold text-foreground">
                              You
                            </span>
                          </div>
                        )}

                        <div
                          className={cn(
                            bubbleBase,
                            "bg-primary/50 text-primary-foreground rounded-[1.25rem] rounded-tr-lg overflow-hidden",
                          )}>
                          <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words relative z-10">
                            {pendingOutgoingText}
                          </div>
                          {/* Shimmer sweep */}
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer-sweep_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        </div>
                      </div>

                      {showAvatar ? (
                        <Link
                          to={`/profile/${user?.username}`}
                          className="hover:opacity-80 transition-opacity">
                          <Avatar className="h-8 w-8 shrink-0 opacity-80">
                            <AvatarImage
                              src={user?.profileImage}
                              alt={user?.username}
                            />
                            <AvatarFallback>
                              {user?.username?.[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                      ) : (
                        <div className="w-9 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })()}
          </div>
        )}

        {!loading && messages.length === 0 && !!pendingOutgoingText && (
          <div className="pt-1">
            <div className="flex items-start gap-3 justify-end">
              <div className="flex flex-col max-w-[75%] min-w-0 items-end">
                <div className="relative w-fit max-w-full break-words rounded-[1.25rem] rounded-tr-lg px-4 py-2.5 shadow-sm bg-primary/50 text-primary-foreground overflow-hidden">
                  <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words relative z-10">
                    {pendingOutgoingText}
                  </div>
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer-sweep_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>
              </div>
              <Link
                to={`/profile/${user?.username}`}
                className="hover:opacity-80 transition-opacity">
                <Avatar className="h-8 w-8 shrink-0 opacity-80">
                  <AvatarImage src={user?.profileImage} alt={user?.username} />
                  <AvatarFallback>
                    {user?.username?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
});

