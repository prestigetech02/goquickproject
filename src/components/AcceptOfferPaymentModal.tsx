import { useEffect, useId, useRef, useState } from "react";
import { useToast } from "./ToastProvider";
import { PaymentMethodOptions, type ErrandPayMethod } from "./PaymentMethodOptions";
import { getApiErrorMessage } from "../lib/http";
import { quoteReservedCoupon } from "../lib/errandApi";
import {
  completePaystackWalletFunding,
  shortfallToFund,
} from "../lib/paystackCheckout";
import {
  useAcceptOfferMutation,
  useFundWalletMutation,
  useProfileQuery,
  useVerifyWalletFundingMutation,
  useWalletQuery,
} from "../lib/queries";
import {
  formatNaira,
  runnerDisplayName,
  type CouponPreview,
  type ErrandOffer,
} from "../types/errand";

type Props = {
  errandId: number;
  offer: ErrandOffer;
  /** Flat admin-configured service fee included in the charge. */
  serviceFee?: number;
  onClose: () => void;
  onPaid: () => void;
};

export function AcceptOfferPaymentModal({
  errandId,
  offer,
  serviceFee = 0,
  onClose,
  onPaid,
}: Props) {
  const titleId = useId();
  const toast = useToast();
  const walletQ = useWalletQuery();
  const { data: profile } = useProfileQuery();
  const fund = useFundWalletMutation();
  const verify = useVerifyWalletFundingMutation();
  const accept = useAcceptOfferMutation(errandId);

  const balance = walletQ.data?.balance ?? null;
  const [method, setMethod] = useState<ErrandPayMethod>("wallet");
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<CouponPreview | null>(null);
  const [quoting, setQuoting] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteErrorCode, setQuoteErrorCode] = useState<string | null>(null);
  const methodInited = useRef(false);

  const fee = Number.isFinite(serviceFee) ? Math.max(0, serviceFee) : 0;
  const chargeAmount = (quote?.payable_amount ?? offer.amount) + fee;
  const couponBlocksPay = Boolean(quoteErrorCode?.startsWith("COUPON_"));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, busy]);

  useEffect(() => {
    if (methodInited.current || walletQ.isPending || balance == null || quoting) return;
    methodInited.current = true;
    setMethod(balance + 0.0001 >= chargeAmount ? "wallet" : "card");
  }, [walletQ.isPending, balance, chargeAmount, quoting]);

  useEffect(() => {
    let cancelled = false;
    setQuoting(true);
    void (async () => {
      const res = await quoteReservedCoupon(errandId, offer.amount);
      if (cancelled) return;
      setQuoting(false);
      if (!res.success) {
        setQuote(null);
        setQuoteError(res.error?.message ?? "Could not quote coupon.");
        setQuoteErrorCode(res.error?.code ?? null);
        return;
      }
      setQuote(res.data);
      setQuoteError(null);
      setQuoteErrorCode(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [errandId, offer.amount]);

  const processing = busy || quoting || accept.isPending || fund.isPending || verify.isPending;

  async function payFromWallet() {
    if (couponBlocksPay) {
      toast.error(quoteError ?? "This coupon cannot be used on this offer.");
      return;
    }
    if (balance == null || balance + 0.0001 < chargeAmount) {
      toast.error("Insufficient wallet balance. Choose card / transfer.");
      setMethod("card");
      return;
    }
    await accept.mutateAsync(offer.id);
    toast.success("Offer accepted. Payment is held in escrow.");
    onPaid();
  }

  async function payWithCard() {
    if (couponBlocksPay) {
      toast.error(quoteError ?? "This coupon cannot be used on this offer.");
      return;
    }
    const email = profile?.email?.trim();
    if (!email) {
      toast.error("Add an email to your profile before paying with card or transfer.");
      return;
    }

    const toFund = shortfallToFund(chargeAmount, balance ?? 0);
    if (toFund > 0) {
      toast.info("Opening Paystack…");
      await completePaystackWalletFunding({
        amount: toFund,
        email,
        callbackUrl: `${window.location.origin}/errands/${errandId}?pay_offer=${offer.id}`,
        fund: (payload) => fund.mutateAsync(payload),
        verify: (reference) => verify.mutateAsync(reference),
      });
    }

    await accept.mutateAsync(offer.id);
    toast.success("Offer accepted. Payment is held in escrow.");
    onPaid();
  }

  async function handleConfirm() {
    if (processing) return;
    setBusy(true);
    try {
      if (method === "wallet") await payFromWallet();
      else await payWithCard();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not complete payment."));
    } finally {
      setBusy(false);
    }
  }

  const runner = runnerDisplayName(offer.runner);

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !processing && onClose()}>
      <div
        className="modal-panel pay-offer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <h2 id={titleId} className="notification-modal-title" style={{ margin: 0 }}>
            Accept &amp; pay
          </h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
            disabled={processing}
          >
            ×
          </button>
        </div>

        <p className="muted pay-offer-copy">
          Accept {runner}’s offer of <strong>{formatNaira(offer.amount)}</strong>
          {fee > 0 ? (
            <>
              {" "}
              plus a <strong>{formatNaira(fee)}</strong> service fee
            </>
          ) : null}
          . You pay <strong>{quoting ? "…" : formatNaira(chargeAmount)}</strong>, held in escrow
          until the errand is completed.
        </p>

        {quoteError ? (
          <p className="error" style={{ margin: "0 0 12px" }}>
            {quoteError}
          </p>
        ) : null}

        <PaymentMethodOptions
          amount={chargeAmount}
          walletBalance={balance}
          walletLoading={walletQ.isPending || quoting}
          method={method}
          onChange={setMethod}
          disabled={processing || couponBlocksPay}
          preview={quote}
        />

        <div className="notification-modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={processing}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={processing || couponBlocksPay}
            onClick={() => void handleConfirm()}
          >
            {quoting
              ? "Checking coupon…"
              : couponBlocksPay
                ? "Coupon cannot be used"
                : processing
                  ? method === "card"
                    ? "Paying…"
                    : "Accepting…"
                  : method === "card"
                    ? `Pay ${formatNaira(chargeAmount)}`
                    : `Pay ${formatNaira(chargeAmount)} from wallet`}
          </button>
        </div>
      </div>
    </div>
  );
}
