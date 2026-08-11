import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getEcho } from "./echo";
import { getStoredUser } from "./auth";
import { markThreadMessagesRead, upsertChatMessage } from "./chatCache";
import { queryKeys } from "./queryClient";
import type { ChatMessagesPayload, ChatThreadsPage } from "../types/chat";
import { markChatThreadRead } from "./chatApi";

type TypingPayload = {
  thread_id?: number;
  user_id?: number;
  is_typing?: boolean;
};

type WhisperChannel = {
  whisper: (event: string, data: Record<string, unknown>) => unknown;
};

function normalizeTyping(payload: unknown): TypingPayload | undefined {
  if (payload == null) return undefined;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload) as TypingPayload;
    } catch {
      return undefined;
    }
  }
  if (typeof payload === "object") {
    return payload as TypingPayload;
  }
  return undefined;
}

/**
 * Subscribe to private-chat-thread.{id} for live message / read / typing.
 * Typing is client-only (whisper); `live` is true after successful subscription.
 */
export function useChatThreadRealtime(threadId: number | null) {
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const channelRef = useRef<WhisperChannel | null>(null);

  useEffect(() => {
    if (threadId == null || threadId <= 0) return;
    const activeThreadId = threadId;

    const echo = getEcho();
    if (!echo) {
      setLive(false);
      setPeerTyping(false);
      channelRef.current = null;
      return;
    }

    const channelName = `chat-thread.${activeThreadId}`;
    let cancelled = false;
    let typingClearTimer: number | null = null;

    function clearTypingSoon() {
      if (typingClearTimer) window.clearTimeout(typingClearTimer);
      typingClearTimer = window.setTimeout(() => {
        if (!cancelled) setPeerTyping(false);
      }, 3000);
    }

    function applyTyping(raw: unknown) {
      if (cancelled) return;
      const payload = normalizeTyping(raw);
      if (!payload) return;
      const cached = qc.getQueryData<ChatMessagesPayload>(
        queryKeys.chatMessages(activeThreadId),
      );
      const me = cached?.current_user_id ?? getStoredUser()?.id ?? 0;
      const userId = Number(payload.user_id) || 0;
      if (me > 0 && userId === me) return;

      const typing = Boolean(payload.is_typing);
      setPeerTyping(typing);
      if (typing) clearTypingSoon();
      else if (typingClearTimer) {
        window.clearTimeout(typingClearTimer);
        typingClearTimer = null;
      }
    }

    try {
      const channel = echo.private(channelName);
      channelRef.current = channel as unknown as WhisperChannel;
      setLive(false);

      channel.subscribed(() => {
        if (!cancelled) setLive(true);
      });
      channel.error(() => {
        if (!cancelled) {
          setLive(false);
          setPeerTyping(false);
        }
      });

      channel.listen(
        ".message.sent",
        (payload: { thread_id?: number; message?: Record<string, unknown> }) => {
          if (cancelled || !payload?.message) return;
          const tid = Number(payload.thread_id) || activeThreadId;
          upsertChatMessage(qc, tid, payload.message);
          setPeerTyping(false);

          const cached = qc.getQueryData<ChatMessagesPayload>(
            queryKeys.chatMessages(activeThreadId),
          );
          const me = cached?.current_user_id ?? 0;
          const senderId = Number(payload.message.sender_id) || 0;
          if (me > 0 && senderId !== me) {
            void markChatThreadRead(activeThreadId).then(() => {
              qc.setQueryData<InfiniteData<ChatThreadsPage>>(queryKeys.chats, (old) => {
                if (!old) return old;
                return {
                  ...old,
                  pages: old.pages.map((page) => {
                    const target = page.threads.find((t) => t.id === activeThreadId);
                    const cleared = target?.unread_count ?? 0;
                    return {
                      ...page,
                      unread_total: Math.max(0, page.unread_total - cleared),
                      threads: page.threads.map((t) =>
                        t.id === activeThreadId
                          ? { ...t, unread_count: 0, missed_call_count: 0 }
                          : t,
                      ),
                    };
                  }),
                };
              });
            });
          }
        },
      );

      channel.listen(".message.read", () => {
        if (cancelled) return;
        const cached = qc.getQueryData<ChatMessagesPayload>(
          queryKeys.chatMessages(activeThreadId),
        );
        const me = cached?.current_user_id ?? 0;
        if (me > 0) {
          markThreadMessagesRead(qc, activeThreadId, me);
        }
      });

      // Peer typing via client whisper (same path as mobile)
      channel.listenForWhisper("typing.status", (payload: unknown) => {
        applyTyping(payload);
      });
    } catch {
      setLive(false);
      setPeerTyping(false);
      channelRef.current = null;
      return;
    }

    return () => {
      cancelled = true;
      setLive(false);
      setPeerTyping(false);
      channelRef.current = null;
      if (typingClearTimer) window.clearTimeout(typingClearTimer);
      try {
        echo.leave(channelName);
      } catch {
        // ignore
      }
    };
  }, [threadId, qc]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (threadId == null || threadId <= 0) return;
      const channel = channelRef.current;
      if (!channel) return;

      const cached = qc.getQueryData<ChatMessagesPayload>(
        queryKeys.chatMessages(threadId),
      );
      const userId = cached?.current_user_id ?? getStoredUser()?.id ?? 0;
      if (userId <= 0) return;

      try {
        channel.whisper("typing.status", {
          thread_id: threadId,
          user_id: userId,
          is_typing: isTyping,
        });
      } catch {
        // non-critical
      }
    },
    [threadId, qc],
  );

  return { live, peerTyping, sendTyping };
}
