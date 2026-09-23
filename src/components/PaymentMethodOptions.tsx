import { formatNaira, type CouponPreview } from "../types/errand";
import { CouponPriceBreakdown } from "./CouponPriceBreakdown";

export type ErrandPayMethod = "wallet" | "card";

type Props = {
  amount: number | null;
  walletBalance: number | null;
  walletLoading?: boolean;
  method: ErrandPayMethod;
  onChange: (method: ErrandPayMethod) => void;
  disabled?: boolean;
  hint?: string;
  preview?: CouponPreview | null;
};

export function PaymentMethodOptions({
  amount,
  walletBalance,
  walletLoading = false,
  method,
  onChange,
  disabled = false,
  hint,
  preview,
}: Props) {
  const walletOk =
    amount != null &&
    Number.isFinite(amount) &&
    walletBalance != null &&
    Number.isFinite(walletBalance) &&
    walletBalance + 0.0001 >= amount;
  const shortfall =
    amount != null &&
    Number.isFinite(amount) &&
    walletBalance != null &&
    Number.isFinite(walletBalance) &&
    !walletOk
      ? Math.max(0, Math.round((amount - walletBalance) * 100) / 100)
      : 0;
  const showLowBalanceAlert =
    method === "wallet" && !walletLoading && shortfall > 0;

  return (
    <div className="pay-method">
      <span className="label">Pay with</span>
      {preview && preview.discount_amount > 0 ? (
        <CouponPriceBreakdown preview={preview} compact />
      ) : amount != null ? (
        <p className="pay-method-amount">
          Amount: <strong>{formatNaira(amount)}</strong>
        </p>
      ) : null}

      <div className="pay-method-options" role="radiogroup" aria-label="Payment method">
        <button
          type="button"
          role="radio"
          aria-checked={method === "wallet"}
          className={`pay-method-option${method === "wallet" ? " selected" : ""}`}
          disabled={disabled}
          onClick={() => onChange("wallet")}
        >
          <span className="pay-method-option-title">Wallet</span>
          <span className="muted">
            {walletLoading
              ? "Loading balance…"
              : walletBalance != null
                ? `${formatNaira(walletBalance)} available`
                : "Could not load balance"}
          </span>
          {showLowBalanceAlert ? (
            <span className="pay-method-warn" role="alert">
              Need {formatNaira(shortfall)} more. Fund with card/transfer, or add money first.
            </span>
          ) : null}
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={method === "card"}
          className={`pay-method-option${method === "card" ? " selected" : ""}`}
          disabled={disabled}
          onClick={() => onChange("card")}
        >
          <span className="pay-method-option-title">Card / transfer</span>
          <span className="muted">Paystack · card or bank transfer</span>
        </button>
      </div>

      {hint ? <p className="muted pay-method-hint">{hint}</p> : null}
    </div>
  );
}
