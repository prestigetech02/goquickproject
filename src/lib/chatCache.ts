import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryClient";
import {
  parseChatMessage,
  type ChatMessage,
  type ChatMessagesPayload,
  type ChatThreadsPage,
} from "../types/chat";

function emptyMessagesPayload(message: ChatMessage): ChatMessagesPayload {
  return {
    messages: [message],
    current_user_id: 0,
    peer: {
      id: 0,
      name: "Unknown",
      is_online: false,
      profile_picture: null,
      phone: null,
    },
    has_more: false,
  };
}

/** Currently open chat thread (nav badge skips incrementing this one). */
let activeChatThreadId: number | null = null;

export function setActiveChatThreadId(id: number | null) {
  activeChatThreadId = id;
}

export function getActiveChatThreadId(): number | null {
  return activeChatThreadId;
}

function withUnreadTotal(
  old: InfiniteData<ChatThreadsPage>,
  nextTotal: number,
  mapThreads: (page: ChatThreadsPage) => ChatThreadsPage["threads"],
): InfiniteData<ChatThreadsPage> {
  const total = Math.max(0, nextTotal);
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      unread_total: total,
      threads: mapThreads(page),
    })),
  };
}

function findThreadUnread(old: InfiniteData<ChatThreadsPage>, threadId: number): number | null {
  for (const page of old.pages) {
    const t = page.threads.find((x) => x.id === threadId);
    if (t) return t.unread_count;
  }
  return null;
}

/** Set a thread's unread count and keep global unread_total in sync on every page. */
export function setThreadUnread(qc: QueryClient, threadId: number, unreadCount: number) {
  let missingFromCache = false;
  qc.setQueryData<InfiniteData<ChatThreadsPage>>(queryKeys.chats, (old) => {
    if (!old) return old;
    const prev = findThreadUnread(old, threadId);
    if (prev == null) {
      missingFromCache = unreadCount === 0;
      if (unreadCount === 0) return old;
      const currentTotal = old.pages[0]?.unread_total ?? 0;
      return withUnreadTotal(old, currentTotal + unreadCount, (page) => page.threads);
    }
    const currentTotal = old.pages[0]?.unread_total ?? 0;
    const delta = unreadCount - prev;
    return withUnreadTotal(old, currentTotal + delta, (page) =>
      page.threads.map((t) =>
        t.id === threadId
          ? {
              ...t,
              unread_count: unreadCount,
              missed_call_count: unreadCount === 0 ? 0 : t.missed_call_count,
            }
          : t,
      ),
    );
  });
  if (missingFromCache) {
    void qc.invalidateQueries({ queryKey: queryKeys.chats });
  }
}

export function incrementThreadUnread(qc: QueryClient, threadId: number) {
  qc.setQueryData<InfiniteData<ChatThreadsPage>>(queryKeys.chats, (old) => {
    if (!old) return old;
    const currentTotal = old.pages[0]?.unread_total ?? 0;
    return withUnreadTotal(old, currentTotal + 1, (page) =>
      page.threads.map((t) =>
        t.id === threadId ? { ...t, unread_count: t.unread_count + 1 } : t,
      ),
    );
  });
}

export function removeThreadFromChats(qc: QueryClient, threadId: number) {
  qc.setQueryData<InfiniteData<ChatThreadsPage>>(queryKeys.chats, (old) => {
    if (!old) return old;
    const prev = findThreadUnread(old, threadId) ?? 0;
    const currentTotal = old.pages[0]?.unread_total ?? 0;
    return withUnreadTotal(old, currentTotal - prev, (page) =>
      page.threads.filter((t) => t.id !== threadId),
    );
  });
}

export function upsertChatMessage(
  qc: QueryClient,
  threadId: number,
  raw: ChatMessage | Record<string, unknown>,
) {
  const message = parseChatMessage(raw as Record<string, unknown>);

  qc.setQueryData<ChatMessagesPayload>(queryKeys.chatMessages(threadId), (old) => {
    if (!old) return emptyMessagesPayload(message);

    const messages = [...old.messages];
    let idx = -1;
    if (message.client_id) {
      idx = messages.findIndex((m) => m.client_id === message.client_id);
    }
    if (idx < 0 && message.id > 0) {
      idx = messages.findIndex((m) => m.id === message.id);
    }

    if (idx >= 0) {
      messages[idx] = { ...messages[idx], ...message };
    } else {
      messages.push(message);
    }

    messages.sort((a, b) => {
      const at = Date.parse(a.created_at) || 0;
      const bt = Date.parse(b.created_at) || 0;
      if (at !== bt) return at - bt;
      return a.id - b.id;
    });

    return { ...old, messages };
  });

  const preview = message.message?.trim() || "New message";
  qc.setQueryData<InfiniteData<ChatThreadsPage>>(queryKeys.chats, (old) => {
    if (!old) return old;
    const stamp = message.created_at || new Date().toISOString();

    const pages = old.pages.map((page) => {
      const threads = page.threads.map((t) =>
        t.id === threadId
          ? { ...t, last_message: preview, last_message_at: stamp }
          : t,
      );
      threads.sort((a, b) => {
        const at = a.last_message_at ? Date.parse(a.last_message_at) : 0;
        const bt = b.last_message_at ? Date.parse(b.last_message_at) : 0;
        return bt - at;
      });
      return { ...page, threads };
    });

    return { ...old, pages };
  });
}

export function markThreadMessagesRead(
  qc: QueryClient,
  threadId: number,
  currentUserId: number,
) {
  qc.setQueryData<ChatMessagesPayload>(queryKeys.chatMessages(threadId), (old) => {
    if (!old) return old;
    return {
      ...old,
      messages: old.messages.map((m) =>
        m.sender_id === currentUserId && m.status !== "read"
          ? { ...m, status: "read" }
          : m,
      ),
    };
  });
}

export function removeOptimisticMessage(
  qc: QueryClient,
  threadId: number,
  clientId: string | undefined,
) {
  if (!clientId) return;
  qc.setQueryData<ChatMessagesPayload>(queryKeys.chatMessages(threadId), (old) => {
    if (!old) return old;
    return {
      ...old,
      messages: old.messages.filter((m) => !(m.client_id === clientId && m.id < 0)),
    };
  });
}
