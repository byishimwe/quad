import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatMessageList } from "./chat/ChatMessageList";
import { ChatTypingIndicator } from "./chat/ChatTypingIndicator";
import { MAX_MESSAGE_LENGTH } from "./chat/constants";
import { useNearBottom } from "./chat/useNearBottom";
import { useChatComposer } from "./chat/useChatComposer";
import { useChatHistory } from "./chat/useChatHistory";
import { useChatMessageActions } from "./chat/useChatMessageActions";
import { useChatReadMarker } from "./chat/useChatReadMarker";
import { useChatSocket } from "./chat/useChatSocket";

export default function ChatPage() {
  const { user } = useAuthStore();

  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDiscardEdit, setConfirmDiscardEdit] = useState(false);

  const [pendingOutgoingText, setPendingOutgoingText] = useState<string | null>(
    null,
  );

  const listRef = useRef<HTMLDivElement | null>(null);

  const pendingScrollBottomRef = useRef(false);
  const pendingRestoreAfterPrependRef = useRef(false);
  const pendingPrependScrollRef = useRef<{
    prevScrollHeight: number;
    prevScrollTop: number;
  } | null>(null);

  const nearBottom = useNearBottom(listRef, 120);

  const handleInitialLoaded = useCallback(() => {
    pendingScrollBottomRef.current = true;
  }, []);

  const handlePrepended = useCallback(() => {
    pendingRestoreAfterPrependRef.current = true;
  }, []);

  const {
    messages,
    setMessages,
    loading,
    initialLoadError,
    loadingOlder,
    hasMoreOlder,
    newestMessageId,
    loadOlder,
    reload,
  } = useChatHistory({
    onInitialLoaded: handleInitialLoaded,
    onPrepended: handlePrepended,
  });

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (!pendingScrollBottomRef.current) return;
    pendingScrollBottomRef.current = false;
    requestAnimationFrame(() => scrollToBottom());
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (!pendingRestoreAfterPrependRef.current) return;
    const el = listRef.current;
    const prev = pendingPrependScrollRef.current;
    pendingRestoreAfterPrependRef.current = false;

    if (!el || !prev) {
      pendingPrependScrollRef.current = null;
      return;
    }

    requestAnimationFrame(() => {
      const newScrollHeight = el.scrollHeight;
      const diff = newScrollHeight - prev.prevScrollHeight;
      el.scrollTop = prev.prevScrollTop + diff;
      pendingPrependScrollRef.current = null;
    });
  }, [messages.length]);

  const handleLoadOlder = useCallback(() => {
    const el = listRef.current;
    if (el) {
      pendingPrependScrollRef.current = {
        prevScrollHeight: el.scrollHeight,
        prevScrollTop: el.scrollTop,
      };
    }
    void loadOlder();
  }, [loadOlder]);

  const { typingUsers, emitTypingStart, emitTypingStop } = useChatSocket({
    user,
    nearBottom,
    scrollToBottom,
    setMessages,
  });

  useChatReadMarker({ newestMessageId, nearBottom });

  const {
    editingId,
    setEditingId,
    editText,
    setEditText,
    handleEdit,
    handleSaveEdit,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    deleting,
    handleDeleteClick,
    handleDeleteConfirm,
  } = useChatMessageActions({ setMessages });

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText("");
    setConfirmDiscardEdit(false);
  }, [setEditText, setEditingId]);

  const handleSaveEditClick = useCallback(async () => {
    if (!editingId) return;
    try {
      setSavingEdit(true);
      await handleSaveEdit(editingId);
    } finally {
      setSavingEdit(false);
    }
  }, [editingId, handleSaveEdit]);

  const originalEditText = editingId
    ? messages.find((message) => message.id === editingId)?.text || ""
    : "";
  const hasEditChanges =
    editingId !== null && editText.trim() !== originalEditText.trim();
  const canSaveEdit =
    !savingEdit && hasEditChanges && editText.trim().length > 0;

  const requestCloseEdit = useCallback(() => {
    if (!editingId) return;
    if (savingEdit) return;
    if (hasEditChanges) {
      setConfirmDiscardEdit(true);
      return;
    }
    handleCancelEdit();
  }, [editingId, handleCancelEdit, hasEditChanges, savingEdit]);

  useEffect(() => {
    if (!editingId) return;
    requestAnimationFrame(() => {
      editTextareaRef.current?.focus();
    });
  }, [editingId]);

  const { text, sending, handleTextChange, handleSend } = useChatComposer({
    emitTypingStart,
    emitTypingStop,
    onMessageSent: (m) => {
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
      setPendingOutgoingText(null);
      requestAnimationFrame(() => scrollToBottom());
    },
    onSendStart: (outgoing) => {
      setPendingOutgoingText(outgoing);
      requestAnimationFrame(() => scrollToBottom());
    },
    onSendError: () => {
      setPendingOutgoingText(null);
    },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ChatMessageList
        listRef={listRef}
        loading={loading}
        error={initialLoadError}
        onRetry={reload}
        loadingOlder={loadingOlder}
        hasMoreOlder={hasMoreOlder}
        onLoadOlder={handleLoadOlder}
        messages={messages}
        pendingOutgoingText={pendingOutgoingText}
        user={user}
        onStartEdit={handleEdit}
        onDeleteMessage={handleDeleteClick}
      />

      <Dialog
        open={!!editingId}
        onOpenChange={(open) => !open && requestCloseEdit()}>
        <DialogContent className="max-w-xl" showClose={!savingEdit}>
          <DialogHeader>
            <DialogTitle>
              {confirmDiscardEdit ? "Discard changes?" : "Edit message"}
            </DialogTitle>
            <DialogDescription>
              {confirmDiscardEdit
                ? "You have unsaved edits. If you discard, your changes will be lost."
                : "Press Enter to save, Shift+Enter for a new line."}
            </DialogDescription>
          </DialogHeader>

          {confirmDiscardEdit ? (
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setConfirmDiscardEdit(false);
                  requestAnimationFrame(() => editTextareaRef.current?.focus());
                }}
                disabled={savingEdit}>
                Keep editing
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancelEdit}
                disabled={savingEdit}>
                Discard
              </Button>
            </DialogFooter>
          ) : (
            <>
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/40 bg-muted/20 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground/50">
                    Original
                  </div>
                  <div className="mt-1.5 text-sm text-muted-foreground/70 whitespace-pre-wrap break-words leading-relaxed">
                    {originalEditText.trim().length > 0
                      ? originalEditText
                      : "(empty message)"}
                  </div>
                </div>

                <textarea
                  ref={editTextareaRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  maxLength={MAX_MESSAGE_LENGTH}
                  rows={4}
                  className="w-full rounded-2xl bg-background border border-border/60 px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/40 focus:ring-[3px] focus:ring-primary/10 resize-none transition-all duration-200"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      requestCloseEdit();
                      return;
                    }

                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (canSaveEdit) void handleSaveEditClick();
                    }
                  }}
                />

                <div className="flex items-center justify-between text-[11px] text-muted-foreground/50 px-1">
                  <span className="font-medium">
                    {editText.trim().length === 0
                      ? "Message cannot be empty"
                      : !hasEditChanges
                        ? "No changes"
                        : ""}
                  </span>
                  <span className="tabular-nums font-bold">
                    {editText.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={requestCloseEdit}
                  disabled={savingEdit}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSaveEditClick()}
                  loading={savingEdit}
                  disabled={!canSaveEdit}>
                  Save changes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {Object.keys(typingUsers).length > 0 && (
        <ChatTypingIndicator typingUsers={typingUsers} />
      )}

      <ChatComposer
        text={text}
        sending={sending}
        onTextChange={handleTextChange}
        onSend={() => void handleSend()}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Message"
        description="Are you sure you want to delete this message? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
    </div>
  );
}
