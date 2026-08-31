import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryClient";
import type { Errand, ErrandStatusFilter, ErrandsListResult } from "../types/errand";

export type ErrandStatusPayload = {
  errand_id?: number;
  status?: string;
  updated_at?: string;
};

export function errandListBucket(status: string): Exclude<ErrandStatusFilter, "all"> {
  const s = status.toLowerCase();
  if (s === "completed" || s === "delivered") return "completed";
  if (
    s.startsWith("cancelled") ||
    s === "failed" ||
    s === "disputed"
  ) {
    return "cancelled";
  }
  return "active";
}

function patchErrandFields(errand: Errand, status: string, updatedAt?: string): Errand {
  const next: Errand = {
    ...errand,
    status,
    updated_at: updatedAt ?? errand.updated_at,
  };
  const s = status.toLowerCase();
  if ((s === "completed" || s === "delivered") && !next.completed_at) {
    next.completed_at = updatedAt ?? new Date().toISOString();
  }
  return next;
}

function patchInfiniteList(
  old: InfiniteData<ErrandsListResult>,
  errandId: number,
  status: string,
  updatedAt: string | undefined,
  filter: ErrandStatusFilter,
  snapshot: Errand | undefined,
): InfiniteData<ErrandsListResult> {
  const bucket = errandListBucket(status);
  const keepInThisList = filter === "all" || filter === bucket;
  let found = false;

  const pages = old.pages.map((page) => {
    const index = page.errands.findIndex((e) => e.id === errandId);
    if (index < 0) return page;
    found = true;
    if (!keepInThisList) {
      return {
        ...page,
        errands: page.errands.filter((e) => e.id !== errandId),
        pagination: {
          ...page.pagination,
          total_items: Math.max(0, page.pagination.total_items - 1),
        },
      };
    }
    return {
      ...page,
      errands: page.errands.map((e) =>
        e.id === errandId ? patchErrandFields(e, status, updatedAt) : e,
      ),
    };
  });

  if (!found && keepInThisList && snapshot && pages[0]) {
    pages[0] = {
      ...pages[0],
      errands: [snapshot, ...pages[0].errands.filter((e) => e.id !== errandId)],
    };
  }

  return { ...old, pages };
}

/** Put a newly created errand at the top of dashboard/list caches immediately. */
export function insertCreatedErrand(qc: QueryClient, errand: Errand) {
  qc.setQueryData(queryKeys.errand(errand.id), (prev: Errand | undefined) =>
    prev ? { ...prev, ...errand } : errand,
  );

  const filters: ErrandStatusFilter[] = ["all", "active"];
  for (const filter of filters) {
    qc.setQueryData<InfiniteData<ErrandsListResult>>(queryKeys.errands(filter), (old) => {
      if (!old?.pages[0]) return old;
      if (old.pages.some((page) => page.errands.some((e) => e.id === errand.id))) {
        return old;
      }
      const pages = old.pages.map((page, index) => {
        if (index !== 0) return page;
        return {
          ...page,
          errands: [errand, ...page.errands],
          pagination: {
            ...page.pagination,
            total_items: page.pagination.total_items + 1,
          },
        };
      });
      return { ...old, pages };
    });
  }

  qc.setQueriesData<Errand[]>(
    { queryKey: [...queryKeys.errands("active"), "preview"] },
    (old) => {
      const list = old ?? [];
      if (list.some((e) => e.id === errand.id)) return list;
      return [errand, ...list].slice(0, Math.max(list.length, 3));
    },
  );

  qc.setQueryData(queryKeys.errandStats, (old: { active_count: number } | undefined) => {
    if (!old) return old;
    return { ...old, active_count: old.active_count + 1 };
  });
}

/** Instantly apply an errand status to detail, lists, and dashboard preview. */
export function applyErrandStatus(
  qc: QueryClient,
  errandId: number,
  status: string,
  updatedAt?: string,
) {
  if (!errandId || !status) return;

  let snapshot: Errand | undefined;
  qc.setQueryData<Errand>(queryKeys.errand(errandId), (prev) => {
    if (!prev) return prev;
    snapshot = patchErrandFields(prev, status, updatedAt);
    return snapshot;
  });

  const filters: ErrandStatusFilter[] = ["all", "active", "completed", "cancelled"];
  for (const filter of filters) {
    qc.setQueryData<InfiniteData<ErrandsListResult>>(queryKeys.errands(filter), (old) => {
      if (!old) return old;
      return patchInfiniteList(old, errandId, status, updatedAt, filter, snapshot);
    });
  }

  qc.setQueriesData<Errand[]>(
    { queryKey: [...queryKeys.errands("active"), "preview"] },
    (old) => {
      if (!old) return old;
      const bucket = errandListBucket(status);
      if (bucket !== "active") {
        return old.filter((e) => e.id !== errandId);
      }
      if (old.some((e) => e.id === errandId)) {
        return old.map((e) =>
          e.id === errandId ? patchErrandFields(e, status, updatedAt) : e,
        );
      }
      if (snapshot) {
        return [snapshot, ...old.filter((e) => e.id !== errandId)].slice(0, Math.max(old.length, 1));
      }
      return old;
    },
  );
}

export function applyErrandStatusPayload(qc: QueryClient, payload: ErrandStatusPayload) {
  const errandId = Number(payload?.errand_id) || 0;
  const status = String(payload?.status || "").trim();
  if (!errandId || !status) return;
  applyErrandStatus(qc, errandId, status, payload.updated_at);
}

/**
 * Optimistic status patch (instant UI) + invalidate so detail/proof/tracking refetch.
 * Keeps cache usable while ensuring Reverb-driven changes pull full server state.
 */
export function syncErrandAfterRealtime(
  qc: QueryClient,
  errandId: number,
  options?: { status?: string; updatedAt?: string },
) {
  if (!errandId) return;

  const status = options?.status?.trim();
  if (status) {
    applyErrandStatus(qc, errandId, status, options?.updatedAt);
  }

  void qc.invalidateQueries({ queryKey: queryKeys.errand(errandId) });
  void qc.invalidateQueries({ queryKey: queryKeys.errandOffers(errandId) });
  void qc.invalidateQueries({ queryKey: queryKeys.errandTracking(errandId) });
  void qc.invalidateQueries({ queryKey: ["errands"] });
  void qc.invalidateQueries({ queryKey: queryKeys.errandStats });
}
