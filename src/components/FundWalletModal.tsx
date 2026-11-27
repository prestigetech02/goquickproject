import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useToast } from "./ToastProvider";
import { getApiErrorMessage } from "../lib/http";
import { useFundWalletMutation, useProfileQuery } from "../lib/queries";
import { formatNaira } from "../types/errand";

const PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];

type Props = {
  onClose: () => void;
  organizationId?: number | null;
  title?: string;
};

export function FundWalletModal({ onClose, organizationId = null, title }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { data: profile } = useProfileQuery();
  const fund = useFundWalletMutation();

  const [amount, setAmount] = useState("");
  const heading = title ?? (organizationId ? "Fund business wallet" : "Fund wallet");

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !fund.isPending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, fund.isPending]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(String(amount).replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error("Enter a valid amount (min ₦1).");
      return;
    }

    const email = profile?.email?.trim();
    if (!email) {
      toast.error("Add an email to your profile before funding your wallet.");
      return;
    }

    try {
      const data = await fund.mutateAsync({
        amount: parsed,
        email,
        organizationId,
        callbackUrl: organizationId
          ? `${window.location.origin}/wallet?org=${organizationId}`
          : `${window.location.origin}/wallet`,
      });
      window.location.assign(data.authorization_url!);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not start payment."));
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !fund.isPending && onClose()}>
      <div
        className="modal-panel wallet-fund-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <h2 id={titleId} className="notification-modal-title" style={{ margin: 0 }}>
            {heading}
          </h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
            disabled={fund.isPending}
          >
            ×
          </button>
        </div>

        <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
          <p className="muted" style={{ margin: 0 }}>
            {organizationId
              ? "Top up the business prepaid wallet. Org errands debit this balance."
              : "Choose an amount to add to your GoQuick wallet."}
          </p>
          <div className="wallet-fund-presets">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`wallet-preset${Number(amount) === preset ? " selected" : ""}`}
                onClick={() => setAmount(String(preset))}
              >
                {formatNaira(preset)}
              </button>
            ))}
          </div>
          <label className="stack">
            <span className="muted">Amount (₦)</span>
            <input
              ref={inputRef}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5000"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={fund.isPending}>
            {fund.isPending ? "Starting payment…" : "Continue to Paystack"}
          </button>
        </form>
      </div>
    </div>
  );
}
