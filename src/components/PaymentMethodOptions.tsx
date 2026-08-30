import { formatNaira } from "../types/errand";

export type ErrandPayMethod = "wallet" | "card";

type Props = {
  amount: number | null;
  walletBalance: number | null;
  walletLoading?: boolean;
  method: ErrandPayMethod;
  onChange: (method: ErrandPayMethod) => void;
  disabled?: boolean;
  hint?: string;
};

export function PaymentMethodOptions({
  amount,
  walletBalance,
  walletLoading = false,
  method,
  onChange,
  disabled = false,
  hint,
}: Props) {
  const walletOk =
    amount != null && walletBalance != null && walletBalance + 0.0001 >= amount;
  const shortfall =
    amount != null && walletBalance != null && !walletOk
      ? Math.max(0, Math.round((amount - walletBalance) * 100) / 100)
      : 0;

  return (
    <div className="pay-method">
      <span className="label">Pay with</span>
      {amount != null ? (
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
          {method === "wallet" && amount != null && !walletLoading && !walletOk ? (
            <span className="pay-method-warn">
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
