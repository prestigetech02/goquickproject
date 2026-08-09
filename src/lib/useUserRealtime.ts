import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getStoredUser } from "./auth";
import { getEcho } from "./echo";
import { queryKeys } from "./queryClient";

type NotificationPayload = {
  id?: number;
  type?: string;
  title?: string;
  message?: string;
  data?: Record<string, unknown> | null;
};

/**
 * Subscribe to private-user.{id} for notification.created.
 * Keeps unread badge + notification/chat lists fresh.
 */
export function useUserRealtime() {
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const userId = getStoredUser()?.id ?? 0;

  useEffect(() => {
    if (!userId) {
      setLive(false);
      return;
    }

    const echo = getEcho();
    if (!echo) {
      setLive(false);
      return;
    }

    const channelName = `user.${userId}`;
    let cancelled = false;

    try {
      const channel = echo.private(channelName);
      setLive(true);

      channel.listen(".notification.created", (payload: NotificationPayload) => {
        if (cancelled) return;
        void qc.invalidateQueries({ queryKey: queryKeys.notificationsUnread });
        void qc.invalidateQueries({ queryKey: queryKeys.notifications });

        const type = String(payload?.type || "").toLowerCase();
        if (type.includes("chat") || type.includes("message")) {
          void qc.invalidateQueries({ queryKey: queryKeys.chats });
        }
        if (
          type.includes("errand") ||
          type.includes("offer") ||
          type.includes("proof") ||
          type.includes("escrow")
        ) {
          void qc.invalidateQueries({ queryKey: ["errands"] });
          void qc.invalidateQueries({ queryKey: queryKeys.errandStats });
        }
        if (type.includes("wallet") || type.includes("payment") || type.includes("payout")) {
          void qc.invalidateQueries({ queryKey: queryKeys.wallet });
          void qc.invalidateQueries({ queryKey: queryKeys.walletTransactions });
        }
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
  }, [userId, qc]);

  return { live };
}
