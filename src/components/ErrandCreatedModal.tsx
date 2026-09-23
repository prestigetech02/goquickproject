import { useEffect, useId, useRef } from "react";
import { CouponPriceBreakdown } from "./CouponPriceBreakdown";
import { formatNaira } from "../types/errand";
import type { CreateErrandResult } from "../lib/errandApi";

type Props = {
  result: CreateErrandResult;
  onContinue: () => void;
};

export function ErrandCreatedModal({ result, onContinue }: Props) {
  const titleId = useId();
  const continueRef = useRef<HTMLButtonElement>(null);
  const errand = result.errand;
  const budgetMin = errand.budget_min != null ? Number(errand.budget_min) : null;
  const budgetMax = errand.budget_max != null ? Number(errand.budget_max) : null;
  const listed =
    errand.coupon?.listed_amount && errand.coupon.listed_amount > 0
      ? errand.coupon.listed_amount
      : errand.base_price != null && Number(errand.base_price) > 0
        ? Number(errand.base_price)
        : budgetMin != null && budgetMin > 0
          ? budgetMin
          : budgetMax != null && budgetMax > 0
            ? budgetMax
            : null;
  const coupon = errand.coupon;
  const priceText = listed != null ? formatNaira(listed) : "—";
  const priceLabel = coupon && coupon.discount_amount > 0 ? "You pay" : "Amount";

  useEffect(() => {
    continueRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel errand-created-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="errand-created-icon" aria-hidden>
          ✓
        </div>
        <h2 id={titleId} className="notification-modal-title" style={{ textAlign: "center" }}>
          Errand posted
        </h2>
        <p className="muted" style={{ textAlign: "center", marginTop: 0 }}>
          Nearby runners can now send offers.
        </p>

        <div className="errand-created-summary">
          <div className="errand-created-row">
            <span className="muted">Title</span>
            <strong>{errand.title || "Untitled errand"}</strong>
          </div>
          {errand.pickup_address ? (
            <div className="errand-created-row">
              <span className="muted">Pickup</span>
              <strong>{errand.pickup_address}</strong>
            </div>
          ) : null}
          {errand.dropoff_address ? (
            <div className="errand-created-row">
              <span className="muted">Drop-off</span>
              <strong>{errand.dropoff_address}</strong>
            </div>
          ) : null}
          <div className="errand-created-row price">
            <span className="muted">{priceLabel}</span>
            {coupon && coupon.discount_amount > 0 ? (
              <CouponPriceBreakdown preview={coupon} compact />
            ) : (
              <strong>{priceText}</strong>
            )}
          </div>
        </div>

        <button
          ref={continueRef}
          type="button"
          className="btn-primary"
          style={{ width: "100%" }}
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
