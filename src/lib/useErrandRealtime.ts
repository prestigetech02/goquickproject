import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getEcho } from "./echo";
import { queryKeys } from "./queryClient";
import type { Errand, ErrandOffer } from "../types/errand";

type StatusPayload = {
  errand_id?: number;
  status?: string;
  updated_at?: string;
};

type OfferPayload = {
  errand_id?: number;
  offer?: ErrandOffer;
};

export type RunnerLocationPayload = {
  errand_id?: number;
  runner_id?: number;
  latitude?: number;
  longitude?: number;
  updated_at?: string;
};

/**
 * Subscribe to private-errand.{id} for status, offers, and optional runner location.
 */
export function useErrandRealtime(
  errandId: number | null,
  options?: {
    listenOffers?: boolean;
    listenRunnerLocation?: boolean;
    onRunnerLocation?: (payload: RunnerLocationPayload) => void;
  },
) {
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const listenOffers = options?.listenOffers ?? true;
  const listenRunnerLocation = options?.listenRunnerLocation ?? false;
  const onRunnerLocation = options?.onRunnerLocation;

  useEffect(() => {
    if (errandId == null || errandId <= 0) {
      setLive(false);
      return;
    }

    const echo = getEcho();
    if (!echo) {
      setLive(false);
      return;
    }

    const channelName = `errand.${errandId}`;
    let cancelled = false;

    try {
      const channel = echo.private(channelName);
      setLive(true);

      channel.listen(".errand.status.updated", (payload: StatusPayload) => {
        if (cancelled) return;
        const status = payload?.status;
        if (status) {
          qc.setQueryData(queryKeys.errand(errandId), (prev: Errand | undefined) =>
            prev
              ? {
                  ...prev,
                  status,
                  updated_at: payload.updated_at ?? prev.updated_at,
                }
              : prev,
          );
        }
        void qc.invalidateQueries({ queryKey: queryKeys.errand(errandId) });
        void qc.invalidateQueries({ queryKey: ["errands"] });
        void qc.invalidateQueries({ queryKey: queryKeys.errandStats });
        void qc.invalidateQueries({ queryKey: queryKeys.errandOffers(errandId) });
        void qc.invalidateQueries({ queryKey: queryKeys.errandTracking(errandId) });
      });

      if (listenOffers) {
        channel.listen(".offer.submitted", (payload: OfferPayload) => {
          if (cancelled || !payload?.offer) return;
          const offer = payload.offer;
          qc.setQueryData(queryKeys.errandOffers(errandId), (prev: ErrandOffer[] | undefined) => {
            const list = prev ?? [];
            if (list.some((o) => o.id === offer.id)) {
              return list.map((o) => (o.id === offer.id ? { ...o, ...offer } : o));
            }
            return [offer, ...list];
          });
          void qc.invalidateQueries({ queryKey: queryKeys.errandOffers(errandId) });
        });
      }

      if (listenRunnerLocation) {
        channel.listen(".runner.location.updated", (payload: RunnerLocationPayload) => {
          if (cancelled) return;
          const lat = Number(payload?.latitude);
          const lng = Number(payload?.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          onRunnerLocation?.({
            ...payload,
            errand_id: payload.errand_id ?? errandId,
            latitude: lat,
            longitude: lng,
          });
        });
      }
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
  }, [errandId, listenOffers, listenRunnerLocation, onRunnerLocation, qc]);

  return { live };
}
