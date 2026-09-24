import { useState } from "react";
import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { useToast } from "../../components/ToastProvider";
import { useProfileQuery, useReferralQuery } from "../../lib/queries";
import { referralReferrerBonus, referralRequesterDiscount } from "../../types/api";
import { formatNairaWhole } from "../../types/errand";

function formatInviteDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ReferralsPage() {
  const toast = useToast();
  const { data: user } = useProfileQuery();
  const { data, isPending, error, refetch } = useReferralQuery();
  const [copyDone, setCopyDone] = useState(false);

  const code =
    data?.referral_code?.trim() || user?.referral?.referral_code?.trim() || "";
  const history = data?.history ?? [];
  const referred =
    (data?.totals?.referred_requesters ?? 0) + (data?.totals?.referred_runners ?? 0);
  const remainingDiscounts = user?.referral?.requester?.remaining_discounts ?? 0;
  const referrerBonusLabel = formatNairaWhole(
    Number(data?.rewards?.referrer_bonus_amount) || referralReferrerBonus(user?.referral),
  );
  const requesterDiscountLabel = formatNairaWhole(
    Number(data?.rewards?.requester_discount_amount) ||
      referralRequesterDiscount(user?.referral),
  );

  async function copyReferral() {
    if (!code) return;
    const text = `Use my GoQuick referral code ${code} to get ${requesterDiscountLabel} off your first errand.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyDone(true);
      toast.success("Referral message copied.");
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      window.prompt("Copy your referral message:", text);
    }
  }

  return (
    <div className="page profile-page">
      <ProfileSubHeader title="My Referrals" />

      {error ? (
        <p className="error">
          Could not load referrals.{" "}
          <button type="button" className="linkish" onClick={() => void refetch()}>
            Retry
          </button>
        </p>
      ) : null}

      <section className="card stack profile-referral-card">
        <h2 className="profile-card-title">Invite &amp; earn</h2>
        <p className="muted profile-referral-copy">
          {code
            ? `Share your code with friends. Earn ${referrerBonusLabel} when their first errand completes.`
            : "We are generating your invite code…"}
        </p>
        {code ? (
          <div className="profile-referral-row">
            <code className="profile-referral-code">{code}</code>
            <button type="button" className="btn-ghost" onClick={() => void copyReferral()}>
              {copyDone ? "Copied" : "Copy & share"}
            </button>
          </div>
        ) : null}
        {remainingDiscounts > 0 ? (
          <p className="profile-bonus">
            You still have {requesterDiscountLabel} off your first errand as a welcome bonus.
          </p>
        ) : null}
        <p className="muted">
          {isPending ? "Loading stats…" : `${referred} friend${referred === 1 ? "" : "s"} joined with your code.`}
        </p>
      </section>

      <section className="card stack">
        <h2 className="profile-card-title">Referral history</h2>
        {isPending && history.length === 0 ? <p className="muted">Loading…</p> : null}
        {!isPending && history.length === 0 ? (
          <p className="profile-empty">
            No referrals yet. Share your code and you’ll see them here when friends sign up.
          </p>
        ) : (
          <ul className="saved-places-list">
            {history.map((item, index) => (
              <li key={`${item.user_name ?? "user"}-${item.created_at ?? index}`} className="saved-place-row">
                <div>
                  <strong>{item.user_name || "Friend"}</strong>
                  <p className="muted">{formatInviteDate(item.created_at)}</p>
                </div>
                {item.reward_label ? <span className="muted">{item.reward_label}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
