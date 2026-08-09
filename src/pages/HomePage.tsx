import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDate } from "../lib/datetime";
import {
  useActiveErrandsPreviewQuery,
  useErrandStatsQuery,
  useProfileQuery,
  useWalletQuery,
} from "../lib/queries";
import { getStoredUser } from "../lib/auth";
import { isProfileComplete } from "../types/api";
import {
  errandStatusLabel,
  errandStatusTone,
  formatNaira,
  runnerDisplayName,
  type Errand,
} from "../types/errand";

import shoppingIcon from "../assets/errand-types/shopping.png";
import pickupIcon from "../assets/errand-types/pickup.png";
import queueIcon from "../assets/errand-types/queue.png";
import customIcon from "../assets/errand-types/custom.png";

const HIDE_BALANCE_KEY = "requester_hide_balance";

const ERRAND_TYPES = [
  {
    id: "shopping",
    label: "Shopping",
    description: "Groceries, market runs, small items.",
    tone: "shopping",
    icon: shoppingIcon,
  },
  {
    id: "pickup_drop",
    label: "Pickup & Drop",
    description: "Pick up packages and deliver safely.",
    tone: "pickup",
    icon: pickupIcon,
  },
  {
    id: "queue",
    label: "Queue for me",
    description: "Let a runner stand in line on your behalf.",
    tone: "queue",
    icon: queueIcon,
  },
  {
    id: "custom",
    label: "Custom errand",
    description: "Anything else you need help with.",
    tone: "custom",
    icon: customIcon,
  },
] as const;

function formatCompactNaira(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(0)}k`;
  return formatNaira(amount);
}

function ActiveErrandPreview({ errand }: { errand: Errand }) {
  const tone = errandStatusTone(errand.status);
  const runner = runnerDisplayName(errand.runner);
  const route = [errand.pickup_address, errand.dropoff_address].filter(Boolean).join(" → ");

  return (
    <Link to={`/errands/${errand.id}`} className={`dash-errand tone-${tone}`}>
      <span className="dash-errand-top">
        <span className="dash-errand-title">{errand.title || "Untitled errand"}</span>
        <span className={`errand-status tone-${tone}`}>{errandStatusLabel(errand.status)}</span>
      </span>
      <span className="dash-errand-meta muted">{formatDate(errand.created_at)}</span>
      {route ? <span className="dash-errand-route">{route}</span> : null}
      <span className="dash-errand-foot muted">
        {runner ? `Runner: ${runner}` : "No runner yet"}
      </span>
    </Link>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const stored = getStoredUser();
  const { data: profile } = useProfileQuery();
  const user = profile ?? stored;
  const first = user?.first_name?.trim();
  const profileDone = isProfileComplete(user);

  const walletQ = useWalletQuery();
  const statsQ = useErrandStatsQuery();
  const activeQ = useActiveErrandsPreviewQuery(3);

  const [hideBalance, setHideBalance] = useState(() => {
    try {
      return localStorage.getItem(HIDE_BALANCE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(HIDE_BALANCE_KEY, hideBalance ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [hideBalance]);

  function handleNewErrand(type?: string) {
    if (!profileDone) {
      navigate("/complete-profile", { state: { reason: "post_errand" } });
      return;
    }
    navigate(type ? `/errands/new?type=${encodeURIComponent(type)}` : "/errands/new");
  }

  const balance = walletQ.data?.balance ?? 0;
  const balanceLabel = walletQ.isPending
    ? "Loading…"
    : hideBalance
      ? "₦••••••"
      : formatNaira(balance);

  const activeCount = statsQ.data?.active_count;
  const completedCount = statsQ.data?.completed_count;
  const totalSpent = statsQ.data?.total_spent ?? 0;
  const activeErrands = activeQ.data ?? [];

  return (
    <div className="page dash-page">
      {!profileDone ? (
        <div className="profile-banner">
          <div>
            <strong>Finish your profile</strong>
            <p className="muted">Add your name and address to post errands and use your wallet.</p>
          </div>
          <Link to="/complete-profile" className="btn-primary">
            Complete profile
          </Link>
        </div>
      ) : null}

      <header className="dash-header">
        <div>
          <h1 className="dash-greeting">{first ? `Hi, ${first}` : "Welcome"}</h1>
          <p className="muted dash-sub">What do you need help with today?</p>
        </div>
      </header>

      <section className="dash-types" aria-label="Errand types">
        {ERRAND_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`dash-type tone-${t.tone}`}
            onClick={() => handleNewErrand(t.id)}
            title={profileDone ? undefined : "Complete your profile first"}
          >
            <span className="dash-type-icon" aria-hidden>
              <img src={t.icon} alt="" className="dash-type-icon-img" />
            </span>
            <span className="dash-type-label">{t.label}</span>
            <span className="dash-type-desc muted">{t.description}</span>
          </button>
        ))}
      </section>

      <div
        className="dash-wallet"
        role="link"
        tabIndex={0}
        onClick={() => {
          if (!profileDone) {
            navigate("/complete-profile", { state: { reason: "wallet" } });
            return;
          }
          navigate("/wallet");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!profileDone) {
              navigate("/complete-profile", { state: { reason: "wallet" } });
              return;
            }
            navigate("/wallet");
          }
        }}
      >
        <span className="dash-wallet-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 8.5A2.5 2.5 0 015.5 6H18a1 1 0 011 1v1.5M3 8.5V17a2 2 0 002 2h14a2 2 0 002-2v-5.5a1 1 0 00-1-1H16a2 2 0 100 4h4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="dash-wallet-body">
          <span className="dash-wallet-label">
            Wallet balance
            <button
              type="button"
              className="dash-wallet-toggle"
              aria-label={hideBalance ? "Show balance" : "Hide balance"}
              onClick={(e) => {
                e.stopPropagation();
                setHideBalance((v) => !v);
              }}
            >
              {hideBalance ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M3 3l18 18M10.6 10.7a2.5 2.5 0 003.5 3.5M9.9 5.1A10.4 10.4 0 0112 5c5 0 9.3 3.1 11 7.5a11.6 11.6 0 01-4.2 5.1M6.1 6.1A11.6 11.6 0 001 12.5C2.7 16.9 7 20 12 20c1.5 0 2.9-.3 4.2-.8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5C21.3 16.9 17 20 12 20S2.7 16.9 1 12.5z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              )}
            </button>
          </span>
          <span className="dash-wallet-amount">{balanceLabel}</span>
        </span>
        <span className="dash-wallet-chevron" aria-hidden>
          ›
        </span>
      </div>

      <section className="dash-stats" aria-label="Errand stats">
        <div className="dash-stat">
          <strong>{statsQ.isPending ? "…" : (activeCount ?? 0)}</strong>
          <span className="muted">Active</span>
        </div>
        <div className="dash-stat">
          <strong>{statsQ.isPending ? "…" : (completedCount ?? 0)}</strong>
          <span className="muted">Completed</span>
        </div>
        <div className="dash-stat">
          <strong>{statsQ.isPending ? "…" : formatCompactNaira(totalSpent)}</strong>
          <span className="muted">Total spent</span>
        </div>
      </section>

      <section className="dash-section">
        <div className="dash-section-head">
          <h2>Active errands</h2>
          <Link to="/errands?status=active" className="dash-section-action">
            See all
          </Link>
        </div>

        {activeQ.isPending ? (
          <div className="dash-errand-list" aria-busy="true" aria-label="Loading active errands">
            {[0, 1, 2].map((i) => (
              <div key={i} className="dash-errand skeleton-row">
                <span className="skeleton skeleton-line skeleton-line-short" />
                <span className="skeleton skeleton-line" />
                <span className="skeleton skeleton-line skeleton-line-mid" />
              </div>
            ))}
          </div>
        ) : activeQ.isError ? (
          <div className="dash-empty muted">Couldn’t load active errands.</div>
        ) : activeErrands.length === 0 ? (
          <div className="dash-empty">
            <strong>No active errands</strong>
            <p className="muted">When you have an errand in progress, it will show here.</p>
          </div>
        ) : (
          <div className="dash-errand-list">
            {activeErrands.map((e) => (
              <ActiveErrandPreview key={e.id} errand={e} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
