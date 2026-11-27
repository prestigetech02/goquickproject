import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Outlet, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { formatDate } from "../lib/datetime";
import { getStoredUser } from "../lib/auth";
import {
  fetchOrganizationLocations,
  type OrganizationLocation,
} from "../lib/organizationApi";
import {
  getActiveOrganizationId,
  subscribeOrgContext,
  syncOrgContextWithMemberships,
} from "../lib/orgContext";
import { formatErrandCode } from "../lib/publicId";
import { useMyErrandsInfiniteQuery, useProfileQuery } from "../lib/queries";
import { isProfileComplete, userHasBusiness } from "../types/api";
import {
  errandStatusLabel,
  errandStatusTone,
  runnerDisplayName,
  type Errand,
  type ErrandStatusFilter,
} from "../types/errand";
import type { MyErrandsScope } from "../lib/errandApi";

const TABS: { id: ErrandStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const SCOPE_TABS: { id: MyErrandsScope; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "personal", label: "Personal" },
  { id: "business", label: "Business" },
];

function errandOrgLabel(errand: Errand): string | null {
  if (!errand.organization?.name) return null;
  const branch = errand.organization.location?.name?.trim();
  return branch ? `${errand.organization.name} · ${branch}` : errand.organization.name;
}

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
  const orgLabel = errandOrgLabel(errand);

  return (
    <button
      type="button"
      className={`errand-row tone-${tone}${selected ? " selected" : ""}`}
      onClick={onOpen}
      aria-current={selected ? "true" : undefined}
    >
      <span className="errand-row-top">
        <span className="errand-row-title">{errand.title || "Untitled errand"}</span>
        <span className={`errand-status tone-${tone}`}>
          {errandStatusLabel(errand.status, errand.category)}
        </span>
      </span>
      {orgLabel ? <span className="errand-row-org">{orgLabel}</span> : null}
      <span className="errand-row-meta muted">
        {formatErrandCode(errand.id, errand.created_at, errand.code)}
        {errand.created_at ? ` · ${formatDate(errand.created_at)}` : ""}
      </span>
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

  const { data: profile } = useProfileQuery();
  const orgs = profile?.organizations ?? getStoredUser()?.organizations ?? [];
  const hasBusiness = userHasBusiness(profile ?? getStoredUser());
  const activeOrgId = useSyncExternalStore(subscribeOrgContext, getActiveOrganizationId, () => null);
  const activeOrg = activeOrgId != null ? orgs.find((o) => o.id === activeOrgId) ?? null : null;

  useEffect(() => {
    syncOrgContextWithMemberships(orgs);
  }, [orgs]);

  const scopeParam = searchParams.get("scope");
  const scope: MyErrandsScope =
    scopeParam === "all" || scopeParam === "personal" || scopeParam === "business"
      ? scopeParam
      : activeOrg
        ? "business"
        : hasBusiness
          ? "personal"
          : "all";

  const orgParam = Number(searchParams.get("org") || "");
  const organizationId =
    scope === "business"
      ? Number.isFinite(orgParam) && orgParam > 0
        ? orgParam
        : activeOrg?.id ?? orgs[0]?.id ?? null
      : null;

  const branchParam = Number(searchParams.get("branch") || "");
  const organizationLocationId =
    scope === "business" && Number.isFinite(branchParam) && branchParam > 0 ? branchParam : null;

  const [branches, setBranches] = useState<OrganizationLocation[]>([]);
  useEffect(() => {
    if (!organizationId) {
      setBranches([]);
      return;
    }
    let cancelled = false;
    void fetchOrganizationLocations(organizationId)
      .then((res) => {
        if (!cancelled && res.success && res.data?.locations) {
          setBranches(res.data.locations);
        }
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const [query, setQuery] = useState("");
  const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
    useMyErrandsInfiniteQuery(status, {
      refetchInterval: status === "completed" || status === "cancelled" ? false : 15_000,
      scope,
      organizationId,
      organizationLocationId,
    });

  const errands = useMemo(() => data?.pages.flatMap((p) => p.errands) ?? [], [data]);

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
        e.organization?.name,
        e.organization?.location?.name,
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

  function patchParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams);
    mutate(params);
    setSearchParams(params, { replace: true });
  }

  function setStatus(next: ErrandStatusFilter) {
    patchParams((params) => {
      if (next === "all") params.delete("status");
      else params.set("status", next);
    });
  }

  function setScope(next: MyErrandsScope) {
    patchParams((params) => {
      if (next === "all") {
        params.delete("scope");
        params.delete("org");
        params.delete("branch");
        return;
      }
      params.set("scope", next);
      if (next === "personal") {
        params.delete("org");
        params.delete("branch");
      } else if (next === "business") {
        const orgId = activeOrg?.id ?? orgs[0]?.id;
        if (orgId) params.set("org", String(orgId));
        else params.delete("org");
        params.delete("branch");
      }
    });
  }

  function setBranch(next: number | null) {
    patchParams((params) => {
      if (!next) params.delete("branch");
      else params.set("branch", String(next));
    });
  }

  function openErrand(errand: Errand) {
    if (errand.status === "draft") {
      navigate(`/errands/new?draft=${errand.id}`);
      return;
    }
    navigate(`/errands/${errand.id}${searchParams.toString() ? `?${searchParams}` : ""}`);
  }

  function handleNewErrand() {
    if (!isProfileComplete(getStoredUser())) {
      navigate("/complete-profile", { state: { reason: "post_errand" } });
      return;
    }
    navigate("/errands/new");
  }

  const selectedOrgName =
    organizationId != null ? orgs.find((o) => o.id === organizationId)?.name : null;

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
            <p className="muted">
              {scope === "business" && selectedOrgName
                ? `Business jobs for ${selectedOrgName}.`
                : scope === "personal"
                  ? "Your personal requests."
                  : "Track requests, offers, and deliveries."}
            </p>
          </div>

          {hasBusiness ? (
            <div className="errands-tabs errands-scope-tabs" role="tablist" aria-label="Account filter">
              {SCOPE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={scope === tab.id}
                  className={`errands-tab${scope === tab.id ? " active" : ""}`}
                  onClick={() => setScope(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}

          {scope === "business" && branches.length > 0 ? (
            <label className="errand-branch-filter">
              <span className="sr-only">Branch</span>
              <select
                value={organizationLocationId ?? ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setBranch(Number.isFinite(v) && v > 0 ? v : null);
                }}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

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
              placeholder="Search title, place, business, or runner…"
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
                  ? scope === "business"
                    ? "Post an errand while Business is selected to see it here."
                    : "When you post an errand, it will show up here."
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
