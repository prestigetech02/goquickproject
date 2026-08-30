import { useEffect, useId, useRef, useState } from "react";
import { useToast } from "./ToastProvider";
import { PaymentMethodOptions, type ErrandPayMethod } from "./PaymentMethodOptions";
import { getApiErrorMessage } from "../lib/http";
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
import { formatNaira, runnerDisplayName, type ErrandOffer } from "../types/errand";

type Props = {
  errandId: number;
  offer: ErrandOffer;
  onClose: () => void;
  onPaid: () => void;
};

export function AcceptOfferPaymentModal({ errandId, offer, onClose, onPaid }: Props) {
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
  const methodInited = useRef(false);

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
    if (methodInited.current || walletQ.isPending || balance == null) return;
    methodInited.current = true;
    setMethod(balance + 0.0001 >= offer.amount ? "wallet" : "card");
  }, [walletQ.isPending, balance, offer.amount]);

  const processing = busy || accept.isPending || fund.isPending || verify.isPending;

  async function payFromWallet() {
    if (balance == null || balance + 0.0001 < offer.amount) {
      toast.error("Insufficient wallet balance. Choose card / transfer.");
      setMethod("card");
      return;
    }
    await accept.mutateAsync(offer.id);
    toast.success("Offer accepted. Payment is held in escrow.");
    onPaid();
  }

  async function payWithCard() {
    const email = profile?.email?.trim();
    if (!email) {
      toast.error("Add an email to your profile before paying with card or transfer.");
      return;
    }

    const toFund = shortfallToFund(offer.amount, balance ?? 0);
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
          Accept {runner}’s offer of <strong>{formatNaira(offer.amount)}</strong>. This amount is
          deducted from your wallet and held in escrow until the errand is completed.
        </p>

        <PaymentMethodOptions
          amount={offer.amount}
          walletBalance={balance}
          walletLoading={walletQ.isPending}
          method={method}
          onChange={setMethod}
          disabled={processing}
        />

        <div className="notification-modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={processing}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={processing} onClick={() => void handleConfirm()}>
            {processing
              ? method === "card"
                ? "Paying…"
                : "Accepting…"
              : method === "card"
                ? `Pay ${formatNaira(offer.amount)}`
                : `Pay ${formatNaira(offer.amount)} from wallet`}
          </button>
        </div>
      </div>
    </div>
  );
}
