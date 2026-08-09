import { http } from "./http";
import type { ApiResponse } from "../types/api";
import { parseNotification, type AppNotification } from "../types/notification";

export type NotificationListMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type NotificationListResult = {
  items: AppNotification[];
  meta: NotificationListMeta;
};

export async function fetchNotifications(params?: {
  page?: number;
  perPage?: number;
  unreadOnly?: boolean;
}): Promise<ApiResponse<NotificationListResult>> {
  const { data } = await http.get("/notifications", {
    params: {
      page: params?.page ?? 1,
      per_page: params?.perPage ?? 20,
      ...(params?.unreadOnly ? { unread_only: true } : {}),
    },
  });

  const payload = data as {
    success?: boolean;
    data?: unknown;
    meta?: Partial<NotificationListMeta>;
    message?: string;
    error?: { code?: string; message?: string };
  };

  if (!payload.success || !Array.isArray(payload.data)) {
    return {
      success: false,
      data: {
        items: [],
        meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
      },
      error: {
        code: payload.error?.code ?? "UNKNOWN_ERROR",
        message: payload.error?.message ?? payload.message ?? "Failed to load notifications",
      },
    };
  }

  const meta: NotificationListMeta = {
    current_page: Number(payload.meta?.current_page ?? 1),
    last_page: Number(payload.meta?.last_page ?? 1),
    per_page: Number(payload.meta?.per_page ?? 20),
    total: Number(payload.meta?.total ?? payload.data.length),
  };

  return {
    success: true,
    data: {
      items: payload.data.map((item) => parseNotification(item as Record<string, unknown>)),
      meta,
    },
  };
}

export async function fetchUnreadNotificationCount(): Promise<ApiResponse<number>> {
  const { data } = await http.get("/notifications/unread-count");
  const payload = data as {
    success?: boolean;
    data?: { count?: number };
  };
  if (payload.success) {
    return { success: true, data: Number(payload.data?.count ?? 0) };
  }
  return { success: false, data: 0 };
}

export async function markNotificationRead(id: number): Promise<ApiResponse<void>> {
  const { data } = await http.post(`/notifications/${id}/read`);
  return data as ApiResponse<void>;
}

export async function markAllNotificationsRead(): Promise<ApiResponse<void>> {
  const { data } = await http.post("/notifications/mark-all-read");
  return data as ApiResponse<void>;
}

export async function deleteNotification(id: number): Promise<ApiResponse<void>> {
  const { data } = await http.delete(`/notifications/${id}`);
  return data as ApiResponse<void>;
}
