import { useMemo, useState } from "react";
import { Outlet, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { formatDate } from "../lib/datetime";
import { getStoredUser } from "../lib/auth";
import { useMyErrandsInfiniteQuery } from "../lib/queries";
import { isProfileComplete } from "../types/api";
import {
  errandStatusLabel,
  errandStatusTone,
  runnerDisplayName,
  type Errand,
  type ErrandStatusFilter,
} from "../types/errand";

const TABS: { id: ErrandStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

function ErrandRow({
  errand,
  selected,
  onOpen,
}: {
  errand: Errand;
  selected: boolean;
  onOpen: () => void;
}) {
  const tone = errandStatusTone(errand.status);
  const runner = runnerDisplayName(errand.runner);
  const route = [errand.pickup_address, errand.dropoff_address].filter(Boolean).join(" → ");

  return (
    <button
      type="button"
      className={`errand-row tone-${tone}${selected ? " selected" : ""}`}
      onClick={onOpen}
      aria-current={selected ? "true" : undefined}
    >
      <span className="errand-row-top">
        <span className="errand-row-title">{errand.title || "Untitled errand"}</span>
        <span className={`errand-status tone-${tone}`}>{errandStatusLabel(errand.status)}</span>
      </span>
      <span className="errand-row-meta muted">{formatDate(errand.created_at)}</span>
      {route ? <span className="errand-row-route">{route}</span> : null}
      <span className="errand-row-foot muted">
        {runner ? <span>Runner: {runner}</span> : <span>No runner yet</span>}
        {errand.estimated_distance_km != null ? (
          <span>{Number(errand.estimated_distance_km).toFixed(1)} km</span>
        ) : null}
      </span>
    </button>
  );
}

export function ErrandsPage() {
  const navigate = useNavigate();
  const { errandId } = useParams();
  const selectedId = errandId ? Number(errandId) : null;
  const hasDetail = selectedId != null && !Number.isNaN(selectedId) && selectedId > 0;

  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status") as ErrandStatusFilter | null;
  const status: ErrandStatusFilter =
    statusParam && TABS.some((t) => t.id === statusParam) ? statusParam : "all";

  const [query, setQuery] = useState("");
  const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
    useMyErrandsInfiniteQuery(status);

  const errands = useMemo(
    () => data?.pages.flatMap((p) => p.errands) ?? [],
    [data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return errands;
    return errands.filter((e) => {
      const hay = [
        e.title,
        e.description,
        e.pickup_address,
        e.dropoff_address,
        runnerDisplayName(e.runner),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [errands, query]);

  const errorMessage =
    error instanceof Error ? error.message : error ? "Failed to load errands" : null;
  const showSkeleton = isPending && errands.length === 0;

  function setStatus(next: ErrandStatusFilter) {
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("status");
    else params.set("status", next);
    setSearchParams(params, { replace: true });
  }

  function openErrand(errand: Errand) {
    navigate(`/errands/${errand.id}${searchParams.toString() ? `?${searchParams}` : ""}`);
  }

  function handleNewErrand() {
    if (!isProfileComplete(getStoredUser())) {
      navigate("/complete-profile", { state: { reason: "post_errand" } });
      return;
    }
    navigate("/errands/new");
  }

  return (
    <div className={`errands-split${hasDetail ? " has-detail" : ""}`}>
      <aside className="errands-list-panel">
        <div className="errands-list-scroll">
          <div className="errands-list-header">
            <div className="errands-list-title-row">
              <h1>My errands</h1>
              <button
                type="button"
                className="btn-primary errands-new-btn"
                onClick={handleNewErrand}
                title={
                  isProfileComplete(getStoredUser())
                    ? undefined
                    : "Complete your profile first"
                }
              >
                New errand
              </button>
            </div>
            <p className="muted">Track requests, offers, and deliveries.</p>
          </div>

          <div className="errands-tabs" role="tablist" aria-label="Errand filters">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={status === tab.id}
                className={`errands-tab${status === tab.id ? " active" : ""}`}
                onClick={() => setStatus(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="errand-search">
            <span className="sr-only">Search errands</span>
            <input
              type="search"
              placeholder="Search title, place, or runner…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          {errorMessage ? (
            <p className="error">
              {errorMessage}{" "}
              <button type="button" className="linkish" onClick={() => void refetch()}>
                Retry
              </button>
            </p>
          ) : null}

          {showSkeleton ? (
            <div className="errand-list" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="errand-row skeleton-row">
                  <span className="skeleton skeleton-line skeleton-line-short" />
                  <span className="skeleton skeleton-line" />
                  <span className="skeleton skeleton-line skeleton-line-mid" />
                </div>
              ))}
            </div>
          ) : null}

          {!showSkeleton && !errorMessage && filtered.length === 0 ? (
            <div className="errands-empty">
              <h2>{errands.length === 0 ? "No errands yet" : "No matches"}</h2>
              <p className="muted">
                {errands.length === 0
                  ? "When you post an errand, it will show up here."
                  : "Try a different search or filter."}
              </p>
            </div>
          ) : null}

          {!showSkeleton && filtered.length > 0 ? (
            <div className="errand-list">
              {filtered.map((errand) => (
                <ErrandRow
                  key={errand.id}
                  errand={errand}
                  selected={selectedId === errand.id}
                  onOpen={() => openErrand(errand)}
                />
              ))}
            </div>
          ) : null}

          {hasNextPage ? (
            <div className="errand-load-more">
              <button
                type="button"
                className="btn-secondary"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <section className="errands-detail-panel">
        <Outlet />
      </section>
    </div>
  );
}

export function ErrandSelectEmpty() {
  return (
    <div className="errands-detail-empty">
      <div className="empty-notifications-icon" aria-hidden>
        📦
      </div>
      <h2>Select an errand</h2>
      <p className="muted">Choose an item from the list to see status, offers, and actions.</p>
    </div>
  );
}
