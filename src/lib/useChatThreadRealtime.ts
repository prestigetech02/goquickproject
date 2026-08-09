import { useEffect, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getEcho } from "./echo";
import { markThreadMessagesRead, upsertChatMessage } from "./chatCache";
import { queryKeys } from "./queryClient";
import type { ChatMessagesPayload, ChatThreadsPage } from "../types/chat";
import { markChatThreadRead } from "./chatApi";

/**
 * Subscribe to private-chat-thread.{id} for live message.sent / message.read.
 * Falls back to polling when the socket is unavailable.
 */
export function useChatThreadRealtime(threadId: number | null) {
  const qc = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (threadId == null || threadId <= 0) return;

    const echo = getEcho();
    if (!echo) {
      setLive(false);
      return;
    }

    const channelName = `chat-thread.${threadId}`;
    let cancelled = false;

    try {
      const channel = echo.private(channelName);
      setLive(true);

      channel.listen(
        ".message.sent",
        (payload: { thread_id?: number; message?: Record<string, unknown> }) => {
          if (cancelled || !payload?.message) return;
          const tid = Number(payload.thread_id) || threadId;
          upsertChatMessage(qc, tid, payload.message);

          const cached = qc.getQueryData<ChatMessagesPayload>(
            queryKeys.chatMessages(threadId),
          );
          const me = cached?.current_user_id ?? 0;
          const senderId = Number(payload.message.sender_id) || 0;
          if (me > 0 && senderId !== me) {
            void markChatThreadRead(threadId).then(() => {
              qc.setQueryData<InfiniteData<ChatThreadsPage>>(queryKeys.chats, (old) => {
                if (!old) return old;
                return {
                  ...old,
                  pages: old.pages.map((page) => {
                    const target = page.threads.find((t) => t.id === threadId);
                    const cleared = target?.unread_count ?? 0;
                    return {
                      ...page,
                      unread_total: Math.max(0, page.unread_total - cleared),
                      threads: page.threads.map((t) =>
                        t.id === threadId
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

      channel.listen(".message.read", (payload: { thread_id?: number; reader_id?: number }) => {
        if (cancelled) return;
        const cached = qc.getQueryData<ChatMessagesPayload>(
          queryKeys.chatMessages(threadId),
        );
        const me = cached?.current_user_id ?? 0;
        if (me > 0) {
          markThreadMessagesRead(qc, threadId, me);
        }
        void payload;
      });
    } catch {
      setLive(false);
      return;
    }

    return () => {
      cancelled = true;
      setLive(false);
      try {
        echo.leave(channelName);
      } catch {
        // ignore
      }
    };
  }, [threadId, qc]);

  return { live };
}
