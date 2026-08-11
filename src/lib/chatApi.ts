import { http } from "./http";
import type { ApiResponse } from "../types/api";
import {
  parseChatMessage,
  parseChatPeer,
  parseChatThread,
  type ChatMessage,
  type ChatMessagesPayload,
  type ChatThread,
  type ChatThreadsPage,
} from "../types/chat";

const MESSAGES_PAGE_SIZE = 40;

export async function fetchChatThreadsPage(params?: {
  page?: number;
  perPage?: number;
}): Promise<ApiResponse<ChatThreadsPage>> {
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;
  const { data } = await http.get("/chats/threads", {
    params: { page, per_page: perPage },
  });
  const payload = data as {
    success?: boolean;
    data?: {
      threads?: unknown[];
      unread_total?: number;
      pagination?: {
        current_page?: number;
        total_pages?: number;
        total_items?: number;
        per_page?: number;
      };
    };
    message?: string;
    error?: { code?: string; message?: string };
  };

  if (!payload.success || !payload.data || !Array.isArray(payload.data.threads)) {
    return {
      success: false,
      data: {
        threads: [],
        unread_total: 0,
        pagination: { current_page: 1, total_pages: 1, total_items: 0, per_page: perPage },
      },
      error: {
        code: payload.error?.code ?? "UNKNOWN_ERROR",
        message: payload.error?.message ?? payload.message ?? "Failed to load chats",
      },
    };
  }

  const threads = payload.data.threads
    .map((item) => parseChatThread(item as Record<string, unknown>))
    .filter((t) => t.id > 0);

  const pagination = payload.data.pagination;
  return {
    success: true,
    data: {
      threads,
      unread_total: Number(payload.data.unread_total) || 0,
      pagination: {
        current_page: Number(pagination?.current_page) || page,
        total_pages: Number(pagination?.total_pages) || 1,
        total_items: Number(pagination?.total_items) || threads.length,
        per_page: Number(pagination?.per_page) || perPage,
      },
    },
  };
}

/** Full list (legacy) — used only if needed; prefer fetchChatThreadsPage. */
export async function fetchChatThreads(): Promise<ApiResponse<ChatThread[]>> {
  const res = await fetchChatThreadsPage({ page: 1, perPage: 50 });
  if (!res.success || !res.data) {
    return { success: false, data: [], error: res.error };
  }
  // If more pages exist, fetch remaining (badge/list bootstrap) — rare for large inboxes
  let threads = res.data.threads;
  let page = res.data.pagination.current_page;
  while (page < res.data.pagination.total_pages && page < 10) {
    page += 1;
    const next = await fetchChatThreadsPage({ page, perPage: res.data.pagination.per_page });
    if (!next.success || !next.data) break;
    threads = [...threads, ...next.data.threads];
  }
  return { success: true, data: threads };
}

export async function fetchArchivedChatThreads(params?: {
  page?: number;
  perPage?: number;
}): Promise<
  ApiResponse<{
    threads: ChatThread[];
    pagination: ChatThreadsPage["pagination"];
  }>
> {
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;
  const { data } = await http.get("/chats/threads/archived", {
    params: { page, per_page: perPage },
  });
  const payload = data as {
    success?: boolean;
    data?: {
      threads?: unknown[];
      pagination?: ChatThreadsPage["pagination"];
    };
    message?: string;
    error?: { code?: string; message?: string };
  };

  if (!payload.success || !payload.data || !Array.isArray(payload.data.threads)) {
    return {
      success: false,
      data: {
        threads: [],
        pagination: { current_page: 1, total_pages: 1, total_items: 0, per_page: perPage },
      },
      error: {
        code: payload.error?.code ?? "UNKNOWN_ERROR",
        message:
          payload.error?.message ?? payload.message ?? "Failed to load archived chats",
      },
    };
  }

  return {
    success: true,
    data: {
      threads: payload.data.threads
        .map((item) => parseChatThread(item as Record<string, unknown>))
        .filter((t) => t.id > 0),
      pagination: {
        current_page: Number(payload.data.pagination?.current_page) || page,
        total_pages: Number(payload.data.pagination?.total_pages) || 1,
        total_items: Number(payload.data.pagination?.total_items) || 0,
        per_page: Number(payload.data.pagination?.per_page) || perPage,
      },
    },
  };
}

export async function archiveChatThread(threadId: number): Promise<ApiResponse<void>> {
  const { data } = await http.post(`/chats/threads/${threadId}/archive`);
  return data as ApiResponse<void>;
}

export async function fetchChatMessages(
  threadId: number,
  options?: { afterId?: number; beforeId?: number; limit?: number },
): Promise<ApiResponse<ChatMessagesPayload>> {
  const afterId = options?.afterId ?? 0;
  const beforeId = options?.beforeId ?? 0;
  const limit = options?.limit ?? 0;

  const params: Record<string, number> = {};
  if (afterId > 0) params.after_id = afterId;
  if (beforeId > 0) params.before_id = beforeId;
  if (limit > 0) params.limit = limit;
  // Default page size for initial web loads
  if (!afterId && !beforeId && !limit) {
    params.limit = MESSAGES_PAGE_SIZE;
  }

  const { data } = await http.get(`/chats/threads/${threadId}/messages`, {
    params: Object.keys(params).length ? params : undefined,
  });
  const payload = data as {
    success?: boolean;
    data?: {
      messages?: unknown[];
      has_more?: boolean;
      current_user_id?: number;
      peer?: Record<string, unknown>;
    };
    message?: string;
    error?: { code?: string; message?: string };
  };

  if (!payload.success || !payload.data || !Array.isArray(payload.data.messages)) {
    return {
      success: false,
      data: {
        messages: [],
        current_user_id: 0,
        peer: parseChatPeer(null),
        has_more: false,
      },
      error: {
        code: payload.error?.code ?? "UNKNOWN_ERROR",
        message: payload.error?.message ?? payload.message ?? "Failed to load messages",
      },
    };
  }

  return {
    success: true,
    data: {
      messages: payload.data.messages.map((item) =>
        parseChatMessage(item as Record<string, unknown>),
      ),
      current_user_id: Number(payload.data.current_user_id) || 0,
      peer: parseChatPeer(payload.data.peer),
      has_more: Boolean(payload.data.has_more),
    },
  };
}

export { MESSAGES_PAGE_SIZE };

export async function sendChatMessage(
  threadId: number,
  payload: {
    message?: string;
    replyToId?: number;
    clientId?: string;
    attachment?: File;
  },
): Promise<ApiResponse<{ message: ChatMessage }>> {
  if (payload.attachment) {
    const form = new FormData();
    if (payload.message?.trim()) form.append("message", payload.message.trim());
    if (payload.replyToId != null) form.append("reply_to_id", String(payload.replyToId));
    if (payload.clientId) form.append("client_id", payload.clientId);
    form.append("attachment", payload.attachment);

    const { data } = await http.post(`/chats/threads/${threadId}/messages`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return normalizeSendResponse(data);
  }

  const { data } = await http.post(`/chats/threads/${threadId}/messages`, {
    message: payload.message?.trim() ?? "",
    reply_to_id: payload.replyToId,
    client_id: payload.clientId,
  });
  return normalizeSendResponse(data);
}

function normalizeSendResponse(data: unknown): ApiResponse<{ message: ChatMessage }> {
  const payload = data as {
    success?: boolean;
    data?: { message?: Record<string, unknown> };
    message?: string;
    error?: { code?: string; message?: string };
  };

  if (!payload.success || !payload.data?.message) {
    return {
      success: false,
      data: { message: parseChatMessage({}) },
      error: {
        code: payload.error?.code ?? "UNKNOWN_ERROR",
        message: payload.error?.message ?? payload.message ?? "Failed to send message",
      },
    };
  }

  return {
    success: true,
    data: { message: parseChatMessage(payload.data.message) },
  };
}

export async function markChatThreadRead(threadId: number): Promise<ApiResponse<void>> {
  const { data } = await http.post(`/chats/threads/${threadId}/read`);
  return data as ApiResponse<void>;
}
