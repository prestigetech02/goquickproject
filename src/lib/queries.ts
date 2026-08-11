import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { fetchProfile } from "./authApi";
import {
  changePassword,
  deactivateAccount,
  deleteAccount,
  fetchNotificationSettings,
  updateNotificationSettings,
  updateProfile,
  uploadProfilePicture,
  type ProfileUpdatePayload,
} from "./profileApi";
import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notificationApi";
import {
  archiveChatThread,
  fetchChatMessages,
  fetchChatThreadsPage,
  MESSAGES_PAGE_SIZE,
  markChatThreadRead,
  sendChatMessage,
} from "./chatApi";
import {
  acceptErrandCompletion,
  acceptOffer,
  cancelErrand,
  createErrand,
  fetchErrand,
  fetchErrandOffers,
  fetchErrandStats,
  fetchErrandTracking,
  fetchErrandTypeSchemas,
  fetchMyErrands,
  rejectErrandCompletion,
  submitErrandReview,
  type CreateErrandPayload,
} from "./errandApi";
import { fetchWallet, fetchWalletTransactions, fundWallet, verifyWalletFunding } from "./walletApi";
import { getStoredUser, setStoredUser } from "./auth";
import { queryKeys } from "./queryClient";
import { removeOptimisticMessage, upsertChatMessage } from "./chatCache";
import type { NotificationSettings, User } from "../types/api";
import type { NotificationListResult } from "./notificationApi";
import type { AppNotification } from "../types/notification";
import type {
  ChatMessage,
  ChatMessagesPayload,
  ChatThreadsPage,
} from "../types/chat";
import type { Errand, ErrandStatusFilter } from "../types/errand";

const NOTIFICATIONS_PER_PAGE = 20;
const CHATS_PER_PAGE = 15;

type NotificationsInfinite = InfiniteData<NotificationListResult, number>;

export async function loadProfileUser(): Promise<User> {
  const res = await fetchProfile();
  if (!res.success || !res.data) {
    throw new Error(res.error?.message ?? "Failed to load profile");
  }
  const merged: User = {
    ...res.data,
    has_password: res.data.has_password ?? getStoredUser()?.has_password ?? true,
  };
  setStoredUser(merged);
  return merged;
}

export function useProfileQuery() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: loadProfileUser,
    initialData: () => getStoredUser() ?? undefined,
    initialDataUpdatedAt: 0,
  });
}

export function useUpdateProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ProfileUpdatePayload) => {
      const res = await updateProfile(payload);
      if (!res.success) {
        throw new Error(res.error?.message ?? "Failed to update profile");
      }
      return res.data?.user ?? {};
    },
    onSuccess: (partial) => {
      const prev = qc.getQueryData<User>(queryKeys.profile) ?? getStoredUser();
      if (!prev) return;
      const merged: User = { ...prev, ...partial };
      setStoredUser(merged);
      qc.setQueryData(queryKeys.profile, merged);
    },
  });
}

export function useUploadProfilePictureMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (percent: number) => void;
    }) => {
      const res = await uploadProfilePicture(file, onProgress);
      if (!res.success || !res.data?.profile_picture) {
        throw new Error(res.error?.message ?? "Failed to upload photo");
      }
      return res.data.profile_picture;
    },
    onSuccess: (url) => {
      const prev = qc.getQueryData<User>(queryKeys.profile) ?? getStoredUser();
      if (!prev) return;
      const merged: User = { ...prev, profile_picture: url };
      setStoredUser(merged);
      qc.setQueryData(queryKeys.profile, merged);
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: async (payload: {
      current_password: string;
      new_password: string;
      new_password_confirmation: string;
    }) => {
      const res = await changePassword(payload);
      if (!res.success) {
        throw new Error(res.error?.message ?? "Failed to change password");
      }
      return res;
    },
  });
}

export function useNotificationSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.notificationSettings,
    queryFn: async () => {
      const res = await fetchNotificationSettings();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load settings");
      }
      return res.data;
    },
  });
}

export function useUpdateNotificationSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<NotificationSettings>) => {
      const res = await updateNotificationSettings(payload);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to save settings");
      }
      return res.data;
    },
    onSuccess: (settings) => {
      qc.setQueryData(queryKeys.notificationSettings, settings);
      const prev = qc.getQueryData<User>(queryKeys.profile);
      if (prev) {
        const merged = { ...prev, notification_settings: settings };
        setStoredUser(merged);
        qc.setQueryData(queryKeys.profile, merged);
      }
    },
  });
}

export function useDeactivateAccountMutation() {
  return useMutation({
    mutationFn: async (password: string) => {
      const res = await deactivateAccount(password);
      if (!res.success) {
        throw new Error(res.error?.message ?? "Failed to deactivate account");
      }
      return res;
    },
  });
}

export function useDeleteAccountMutation() {
  return useMutation({
    mutationFn: async (payload: { password: string; reason?: string }) => {
      const res = await deleteAccount(payload.password, payload.reason);
      if (!res.success) {
        throw new Error(res.error?.message ?? "Failed to delete account");
      }
      return res;
    },
  });
}

export function useUnreadNotificationCountQuery() {
  return useQuery({
    queryKey: queryKeys.notificationsUnread,
    queryFn: async () => {
      const res = await fetchUnreadNotificationCount();
      if (!res.success) return 0;
      return res.data ?? 0;
    },
  });
}

export function useNotificationsInfiniteQuery() {
  return useInfiniteQuery({
    queryKey: queryKeys.notifications,
    queryFn: async ({ pageParam }) => {
      const res = await fetchNotifications({
        page: pageParam,
        perPage: NOTIFICATIONS_PER_PAGE,
      });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load notifications");
      }
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.current_page < last.meta.last_page
        ? last.meta.current_page + 1
        : undefined,
  });
}

export function useNotificationMutations() {
  const qc = useQueryClient();

  const patchNotifications = (
    updater: (pages: NotificationListResult[]) => NotificationListResult[],
  ) => {
    qc.setQueryData<NotificationsInfinite>(queryKeys.notifications, (old) => {
      if (!old) return old;
      return { ...old, pages: updater(old.pages) };
    });
  };

  const markRead = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: (_data, id) => {
      patchNotifications((pages) =>
        pages.map((page) => ({
          ...page,
          items: page.items.map((n: AppNotification) =>
            n.id === id ? { ...n, is_read: true } : n,
          ),
        })),
      );
      void qc.invalidateQueries({ queryKey: queryKeys.notificationsUnread });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      patchNotifications((pages) =>
        pages.map((page) => ({
          ...page,
          items: page.items.map((n) => ({ ...n, is_read: true })),
        })),
      );
      qc.setQueryData(queryKeys.notificationsUnread, 0);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteNotification(id),
    onSuccess: (_data, id) => {
      patchNotifications((pages) =>
        pages.map((page) => ({
          ...page,
          items: page.items.filter((n) => n.id !== id),
          meta: {
            ...page.meta,
            total: Math.max(0, page.meta.total - 1),
          },
        })),
      );
      void qc.invalidateQueries({ queryKey: queryKeys.notificationsUnread });
    },
  });

  return { markRead, markAllRead, remove };
}

export function useChatThreadsInfiniteQuery() {
  return useInfiniteQuery({
    queryKey: queryKeys.chats,
    queryFn: async ({ pageParam }) => {
      const res = await fetchChatThreadsPage({ page: pageParam, perPage: CHATS_PER_PAGE });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load chats");
      }
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.current_page < last.pagination.total_pages
        ? last.pagination.current_page + 1
        : undefined,
  });
}

/** Flattened threads + total unread (for badges / headers). */
export function useChatThreadsQuery() {
  const query = useChatThreadsInfiniteQuery();
  const threads = query.data?.pages.flatMap((p) => p.threads) ?? [];
  const unreadTotal = query.data?.pages[0]?.unread_total ?? 0;
  return { ...query, data: threads, unreadTotal };
}

export function useArchiveChatMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: number) => archiveChatThread(threadId),
    onSuccess: (_data, threadId) => {
      qc.setQueryData<InfiniteData<ChatThreadsPage>>(queryKeys.chats, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            threads: page.threads.filter((t) => t.id !== threadId),
            unread_total: Math.max(
              0,
              page.unread_total -
                (page.threads.find((t) => t.id === threadId)?.unread_count ?? 0),
            ),
          })),
        };
      });
      void qc.invalidateQueries({ queryKey: queryKeys.chatsArchived });
    },
  });
}

export function useChatMessagesQuery(threadId: number | null, options?: { live?: boolean }) {
  const live = options?.live ?? false;
  const qc = useQueryClient();
  return useQuery({
    queryKey: queryKeys.chatMessages(threadId ?? 0),
    enabled: threadId != null && threadId > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    refetchInterval: live ? false : 12_000,
    queryFn: async () => {
      const tid = threadId!;
      const existing = qc.getQueryData<ChatMessagesPayload>(queryKeys.chatMessages(tid));
      const maxId =
        existing?.messages.reduce((max, m) => (m.id > max ? m.id : max), 0) ?? 0;

      // Soft poll / remount: only fetch newer messages and merge into cache window
      if (existing && maxId > 0) {
        const res = await fetchChatMessages(tid, { afterId: maxId, limit: 100 });
        if (!res.success || !res.data) {
          throw new Error(res.error?.message ?? "Failed to load messages");
        }
        if (res.data.messages.length === 0) {
          return {
            ...existing,
            current_user_id: res.data.current_user_id || existing.current_user_id,
            peer: res.data.peer.id ? res.data.peer : existing.peer,
          };
        }
        const byKey = new Map<string, ChatMessage>();
        for (const m of existing.messages) {
          byKey.set(m.client_id ? `c:${m.client_id}` : `i:${m.id}`, m);
        }
        for (const m of res.data.messages) {
          byKey.set(m.client_id ? `c:${m.client_id}` : `i:${m.id}`, m);
        }
        const messages = [...byKey.values()].sort((a, b) => {
          const at = Date.parse(a.created_at) || 0;
          const bt = Date.parse(b.created_at) || 0;
          if (at !== bt) return at - bt;
          return a.id - b.id;
        });
        return {
          ...existing,
          messages,
          current_user_id: res.data.current_user_id || existing.current_user_id,
          peer: res.data.peer.id ? res.data.peer : existing.peer,
          has_more: existing.has_more,
        };
      }

      const res = await fetchChatMessages(tid, { limit: MESSAGES_PAGE_SIZE });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load messages");
      }
      return res.data;
    },
  });
}

export function useLoadOlderChatMessages(threadId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const existing = qc.getQueryData<ChatMessagesPayload>(queryKeys.chatMessages(threadId));
      const oldest =
        existing?.messages.filter((m) => m.id > 0).reduce((min, m) => Math.min(min, m.id), Infinity) ??
        Infinity;
      if (!Number.isFinite(oldest)) {
        return null;
      }
      const res = await fetchChatMessages(threadId, {
        beforeId: oldest,
        limit: MESSAGES_PAGE_SIZE,
      });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load older messages");
      }
      return res.data;
    },
    onSuccess: (page) => {
      if (!page) return;
      qc.setQueryData<ChatMessagesPayload>(queryKeys.chatMessages(threadId), (old) => {
        if (!old) return { ...page, has_more: page.has_more };
        const seen = new Set(old.messages.map((m) => m.id));
        const older = page.messages.filter((m) => m.id > 0 && !seen.has(m.id));
        return {
          ...old,
          messages: [...older, ...old.messages],
          has_more: page.has_more,
        };
      });
    },
  });
}

export function useMarkChatReadMutation(threadId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markChatThreadRead(threadId),
    onSuccess: () => {
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
                t.id === threadId ? { ...t, unread_count: 0, missed_call_count: 0 } : t,
              ),
            };
          }),
        };
      });
    },
  });
}

export function useSendChatMessageMutation(threadId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      message?: string;
      replyToId?: number;
      clientId?: string;
      attachment?: File;
    }) => sendChatMessage(threadId, payload),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: queryKeys.chatMessages(threadId) });
      const previous = qc.getQueryData<ChatMessagesPayload>(queryKeys.chatMessages(threadId));
      const me = previous?.current_user_id ?? getStoredUser()?.id ?? 0;
      const reply =
        vars.replyToId != null
          ? previous?.messages.find((m) => m.id === vars.replyToId) ?? null
          : null;

      const previewText =
        vars.message?.trim() ||
        (vars.attachment
          ? vars.attachment.type.startsWith("image/")
            ? "📷 Image"
            : "📄 Document"
          : "");

      const optimistic: ChatMessage = {
        id: -Date.now(),
        client_id: vars.clientId ?? null,
        message: previewText,
        status: "sending",
        sender_id: me,
        created_at: new Date().toISOString(),
        reply_to_id: vars.replyToId ?? null,
        reply_to_message: reply
          ? {
              id: reply.id,
              message: reply.message,
              status: reply.status,
              sender_id: reply.sender_id,
              created_at: reply.created_at,
              message_type: reply.message_type,
            }
          : null,
        message_type: "text",
        attachment_url: vars.attachment?.type.startsWith("image/")
          ? URL.createObjectURL(vars.attachment)
          : null,
        attachment_type: vars.attachment
          ? vars.attachment.type.startsWith("image/")
            ? "image"
            : "document"
          : null,
        attachment_name: vars.attachment?.name ?? null,
        attachment_size: vars.attachment?.size ?? null,
      };

      upsertChatMessage(qc, threadId, optimistic);
      return { previous, clientId: vars.clientId, optimisticUrl: optimistic.attachment_url };
    },
    onError: (_err, vars, ctx) => {
      removeOptimisticMessage(qc, threadId, vars.clientId);
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.chatMessages(threadId), ctx.previous);
      }
      if (ctx?.optimisticUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(ctx.optimisticUrl);
      }
    },
    onSuccess: (res, vars, ctx) => {
      if (ctx?.optimisticUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(ctx.optimisticUrl);
      }
      if (!res.success || !res.data?.message) {
        removeOptimisticMessage(qc, threadId, vars.clientId);
        return;
      }
      // Merge server message over optimistic (same client_id)
      upsertChatMessage(qc, threadId, {
        ...res.data.message,
        client_id: res.data.message.client_id || vars.clientId || null,
      });

      // Attachment uploads may omit CDN fields on create — refresh once
      if (vars.attachment) {
        void qc.refetchQueries({ queryKey: queryKeys.chatMessages(threadId) });
      }
    },
  });
}

export function useMyErrandsInfiniteQuery(status: ErrandStatusFilter) {
  return useInfiniteQuery({
    queryKey: queryKeys.errands(status),
    queryFn: async ({ pageParam }) => {
      const res = await fetchMyErrands({
        status: status === "all" ? undefined : status,
        page: pageParam,
        perPage: 20,
      });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load errands");
      }
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (last) => {
      if (last.pagination.current_page < last.pagination.total_pages) {
        return last.pagination.current_page + 1;
      }
      return undefined;
    },
  });
}

export function useErrandQuery(errandId: number | null) {
  return useQuery({
    queryKey: queryKeys.errand(errandId ?? 0),
    enabled: errandId != null && errandId > 0,
    queryFn: async () => {
      const res = await fetchErrand(errandId!);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load errand");
      }
      return res.data;
    },
  });
}

export function useErrandOffersQuery(
  errandId: number | null,
  enabled = true,
  options?: { refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: queryKeys.errandOffers(errandId ?? 0),
    enabled: enabled && errandId != null && errandId > 0,
    refetchInterval: options?.refetchInterval,
    queryFn: async () => {
      const res = await fetchErrandOffers(errandId!);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load offers");
      }
      return res.data;
    },
  });
}

export function useErrandTrackingQuery(errandId: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.errandTracking(errandId ?? 0),
    enabled: enabled && errandId != null && errandId > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetchErrandTracking(errandId!);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load tracking");
      }
      return res.data;
    },
  });
}

export function useCancelErrandMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (errandId: number) => {
      const res = await cancelErrand(errandId);
      if (!res.success) {
        throw new Error(res.error?.message ?? "Failed to cancel errand");
      }
      return res.data?.errand ?? null;
    },
    onSuccess: (errand, errandId) => {
      if (errand) {
        qc.setQueryData(queryKeys.errand(errandId), errand);
      } else {
        void qc.invalidateQueries({ queryKey: queryKeys.errand(errandId) });
      }
      void qc.invalidateQueries({ queryKey: ["errands"] });
    },
  });
}

export function useAcceptOfferMutation(errandId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (offerId: number) => {
      const res = await acceptOffer(offerId);
      if (!res.success || !res.data?.errand) {
        throw new Error(res.error?.message ?? "Failed to accept offer");
      }
      return res.data.errand as Errand;
    },
    onSuccess: (errand) => {
      qc.setQueryData(queryKeys.errand(errandId), errand);
      void qc.invalidateQueries({ queryKey: queryKeys.errandOffers(errandId) });
      void qc.invalidateQueries({ queryKey: ["errands"] });
    },
  });
}

export function useWalletQuery() {
  return useQuery({
    queryKey: queryKeys.wallet,
    queryFn: async () => {
      const res = await fetchWallet();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load wallet");
      }
      return res.data;
    },
  });
}

export function useWalletTransactionsInfiniteQuery(perPage = 20) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.walletTransactions, perPage] as const,
    queryFn: async ({ pageParam }) => {
      const res = await fetchWalletTransactions({ page: pageParam, perPage });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load transactions");
      }
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (last) => {
      if (last.pagination.current_page < last.pagination.total_pages) {
        return last.pagination.current_page + 1;
      }
      return undefined;
    },
  });
}

export function useFundWalletMutation() {
  return useMutation({
    mutationFn: async (payload: { amount: number; email?: string; callbackUrl?: string }) => {
      const res = await fundWallet(payload);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to start funding");
      }
      if (!res.data.authorization_url) {
        throw new Error("Payment link was not returned. Try again.");
      }
      return res.data;
    },
  });
}

export function useVerifyWalletFundingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reference: string) => {
      const res = await verifyWalletFunding(reference);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to verify payment");
      }
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.wallet, (prev: { id: number; balance: number; currency: string } | undefined) =>
        prev
          ? { ...prev, balance: data.wallet_balance }
          : { id: 0, balance: data.wallet_balance, currency: "NGN" },
      );
      void qc.invalidateQueries({ queryKey: queryKeys.wallet });
      void qc.invalidateQueries({ queryKey: queryKeys.walletTransactions });
    },
  });
}

export function useErrandStatsQuery() {
  return useQuery({
    queryKey: queryKeys.errandStats,
    queryFn: async () => {
      const res = await fetchErrandStats();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load stats");
      }
      return res.data;
    },
  });
}

export function useActiveErrandsPreviewQuery(limit = 3) {
  return useQuery({
    queryKey: [...queryKeys.errands("active"), "preview", limit] as const,
    queryFn: async () => {
      const res = await fetchMyErrands({ status: "active", page: 1, perPage: limit });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load active errands");
      }
      return res.data.errands;
    },
  });
}

export function useErrandTypeSchemasQuery() {
  return useQuery({
    queryKey: queryKeys.errandTypeSchemas,
    queryFn: async () => {
      const res = await fetchErrandTypeSchemas();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load errand types");
      }
      return res.data;
    },
  });
}

export function useCreateErrandMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateErrandPayload) => {
      const res = await createErrand(payload);
      if (!res.success || !res.data) {
        const err = new Error(res.error?.message ?? "Failed to create errand") as Error & {
          code?: string;
        };
        err.code = res.error?.code;
        throw err;
      }
      return res.data;
    },
    onSuccess: (data) => {
      const errand = {
        ...data.errand,
        attachments: data.attachments ?? data.errand.attachments ?? null,
      };
      qc.setQueryData(queryKeys.errand(errand.id), errand);
      void qc.invalidateQueries({ queryKey: ["errands"] });
      void qc.invalidateQueries({ queryKey: queryKeys.errandStats });
      void qc.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

export function useAcceptErrandCompletionMutation(errandId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await acceptErrandCompletion(errandId);
      if (!res.success) {
        throw new Error(res.error?.message ?? "Failed to accept proof");
      }
      return res.data?.proof ?? null;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.errand(errandId) });
      void qc.invalidateQueries({ queryKey: ["errands"] });
      void qc.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

export function useRejectErrandCompletionMutation(errandId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rejectionReason: string) => {
      const res = await rejectErrandCompletion(errandId, rejectionReason);
      if (!res.success) {
        throw new Error(res.error?.message ?? "Failed to reject proof");
      }
      return res.data?.proof ?? null;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.errand(errandId) });
      void qc.invalidateQueries({ queryKey: ["errands"] });
    },
  });
}

export function useSubmitErrandReviewMutation(errandId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { rating: number; comment?: string | null }) => {
      const res = await submitErrandReview(errandId, payload);
      if (!res.success) {
        throw new Error(res.error?.message ?? "Failed to submit review");
      }
      return res.data?.review ?? null;
    },
    onSuccess: () => {
      qc.setQueryData(queryKeys.errand(errandId), (prev: Errand | undefined) =>
        prev ? { ...prev, buyer_has_reviewed: true } : prev,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.errand(errandId) });
    },
  });
}
