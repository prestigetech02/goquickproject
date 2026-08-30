import { QueryClient } from "@tanstack/react-query";

/** Shared React Query client — cached data is reused across navigations. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Treat data as fresh for 5 minutes — remounts won't refetch
      staleTime: 5 * 60 * 1000,
      // Keep unused cache for 30 minutes
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    },
  },
});

export const queryKeys = {
  profile: ["profile"] as const,
  notificationSettings: ["profile", "notification-settings"] as const,
  notifications: ["notifications"] as const,
  notificationsPreview: ["notifications", "preview"] as const,
  notificationsUnread: ["notifications", "unread-count"] as const,
  chats: ["chats"] as const,
  chatsArchived: ["chats", "archived"] as const,
  chatMessages: (threadId: number) => ["chats", threadId, "messages"] as const,
  errands: (status: string) => ["errands", status] as const,
  errand: (id: number) => ["errands", "detail", id] as const,
  errandOffers: (id: number) => ["errands", id, "offers"] as const,
  errandTracking: (id: number) => ["errands", id, "tracking"] as const,
  errandStats: ["errands", "stats"] as const,
  errandTypeSchemas: ["errands", "type-schemas"] as const,
  wallet: ["wallet"] as const,
  walletTransactions: ["wallet", "transactions"] as const,
  supportTickets: ["support-tickets", "list"] as const,
  supportTicketsUnread: ["support-tickets", "unread-count"] as const,
  supportTicket: (id: number) => ["support-tickets", "detail", id] as const,
  publicConfig: ["public-config"] as const,
};
