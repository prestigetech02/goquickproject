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
