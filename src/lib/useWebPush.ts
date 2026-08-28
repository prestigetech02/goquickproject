import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryClient";
import {
  bindForegroundPushHandler,
  isWebPushConfigured,
  syncWebPushToken,
} from "./webPush";
import { useNotificationSettingsQuery } from "./queries";

/**
 * Registers the browser for FCM web push when the requester has push enabled.
 * Foreground messages refresh the unread notification count.
 */
export function useWebPush() {
  const qc = useQueryClient();
  const settingsQuery = useNotificationSettingsQuery();
  const pushEnabled = Boolean(settingsQuery.data?.push_enabled);

  useEffect(() => {
    if (!isWebPushConfigured() || !pushEnabled) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      await syncWebPushToken();
      if (cancelled) return;

      const unbind = await bindForegroundPushHandler(() => {
        void qc.invalidateQueries({ queryKey: queryKeys.notifications });
        void qc.invalidateQueries({ queryKey: queryKeys.notificationsUnread });
      });
      if (!cancelled) {
        unsubscribe = unbind;
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [pushEnabled, qc]);
}
