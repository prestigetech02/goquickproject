import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getStoredUser } from "./auth";
import { applyErrandStatus, applyErrandStatusPayload } from "./errandCache";
import { getEcho } from "./echo";
import { getActiveChatThreadId, incrementThreadUnread } from "./chatCache";
import { queryKeys } from "./queryClient";

type NotificationPayload = {
  id?: number;
  type?: string;
  title?: string;
  message?: string;
  data?: Record<string, unknown> | null;
};

type ErrandStatusPayload = {
  errand_id?: number;
  status?: string;
  updated_at?: string;
};

/**
 * Subscribe to private-user.{id} for notifications and errand status.
 * Status patches the cache immediately so list/detail/dashboard update live.
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
      setLive(false);

      channel.subscribed(() => {
        if (!cancelled) setLive(true);
      });
      channel.error(() => {
        if (!cancelled) setLive(false);
      });

      channel.listen(".errand.status.updated", (payload: ErrandStatusPayload) => {
        if (cancelled) return;
        applyErrandStatusPayload(qc, payload);
        const errandId = Number(payload?.errand_id) || 0;
        void qc.invalidateQueries({ queryKey: queryKeys.errandStats });
        if (errandId > 0) {
          void qc.invalidateQueries({ queryKey: queryKeys.errandTracking(errandId) });
        }
      });

      channel.listen(".notification.created", (payload: NotificationPayload) => {
        if (cancelled) return;
        void qc.invalidateQueries({ queryKey: queryKeys.notificationsUnread });
        void qc.invalidateQueries({ queryKey: queryKeys.notifications });

        const nested = payload?.data && typeof payload.data === "object" ? payload.data : {};
        const type = String(payload?.type || nested.type || "").toLowerCase();
        const threadId = Number(nested.thread_id) || 0;
        if (type.includes("chat") || type.includes("message")) {
          const activeId = getActiveChatThreadId();
          if (threadId > 0 && threadId !== activeId) {
            incrementThreadUnread(qc, threadId);
          }
          if (threadId !== activeId) {
            void qc.invalidateQueries({ queryKey: queryKeys.chats });
          }
        }
        const errandId = Number(nested.errand_id) || 0;
        const status = String(nested.status || "").trim();
        if (errandId > 0 && status) {
          applyErrandStatus(qc, errandId, status);
        } else if (
          type.includes("errand") ||
          type.includes("offer") ||
          type.includes("proof") ||
          type.includes("escrow")
        ) {
          void qc.invalidateQueries({ queryKey: ["errands"] });
        }
        if (
          type.includes("errand") ||
          type.includes("offer") ||
          type.includes("proof") ||
          type.includes("escrow")
        ) {
          void qc.invalidateQueries({ queryKey: queryKeys.errandStats });
        }
        if (
          type.includes("wallet") ||
          type.includes("payment") ||
          type.includes("payout") ||
          type.includes("escrow")
        ) {
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
