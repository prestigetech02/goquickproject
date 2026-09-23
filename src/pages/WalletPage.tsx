import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatDateTime } from "../lib/datetime";
import { getApiErrorMessage } from "../lib/http";
import {
  useVerifyWalletFundingMutation,
  useWalletQuery,
  useWalletTransactionsInfiniteQuery,
} from "../lib/queries";
import { formatNaira } from "../types/errand";
import {
  walletTxLabel,
  walletTxSubtitle,
  walletTxTone,
  type WalletTransaction,
} from "../lib/walletApi";
import { FundWalletModal } from "../components/FundWalletModal";
import { useToast } from "../components/ToastProvider";
import { WalletTransactionModal } from "../components/WalletTransactionModal";

const HIDE_BALANCE_KEY = "requester_hide_balance";

function EyeIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.6 10.7a2.5 2.5 0 003.5 3.5M9.9 5.1A10.4 10.4 0 0112 5c5 0 9.3 3.1 11 7.5a11.6 11.6 0 01-4.2 5.1M6.1 6.1A11.6 11.6 0 001 12.5C2.7 16.9 7 20 12 20c1.5 0 2.9-.3 4.2-.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5C21.3 16.9 17 20 12 20S2.7 16.9 1 12.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function WithdrawInfoModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    okRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <h2 id={titleId} className="notification-modal-title" style={{ margin: 0 }}>
            Withdrawals
          </h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="notification-modal-body">
          Wallet withdrawals are available for runners earning from completed errands. As a
          requester, you can fund your wallet and pay for errands here.
        </p>
        <div className="notification-modal-actions">
          <button ref={okRef} type="button" className="btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function TxRow({ tx, onOpen }: { tx: WalletTransaction; onOpen: () => void }) {
  const tone = walletTxTone(tx);
  const credit = String(tx.type).toLowerCase() === "credit";
  const amount = Number(tx.amount) || 0;

  return (
    <button type="button" className={`wallet-tx tone-${tone}`} onClick={onOpen}>
      <span className="wallet-tx-main">
        <strong className="wallet-tx-title">{walletTxLabel(tx)}</strong>
        {walletTxSubtitle(tx) ? (
          <span className="wallet-tx-meta muted">{walletTxSubtitle(tx)}</span>
        ) : null}
        <span className="wallet-tx-meta muted">{formatDateTime(tx.created_at)}</span>
        <span className={`wallet-tx-status tone-${tone}`}>{String(tx.status)}</span>
      </span>
      <span className={`wallet-tx-amount ${credit ? "credit" : "debit"}`}>
        {credit ? "+" : "−"}
        {formatNaira(amount)}
      </span>
    </button>
  );
}

export function WalletPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const walletQ = useWalletQuery();
  const txQ = useWalletTransactionsInfiniteQuery(20);
  const verify = useVerifyWalletFundingMutation();

  const [fundOpen, setFundOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [hideBalance, setHideBalance] = useState(() => {
    try {
      return localStorage.getItem(HIDE_BALANCE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const verifyingRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(HIDE_BALANCE_KEY, hideBalance ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [hideBalance]);

  useEffect(() => {
    const reference =
      searchParams.get("reference")?.trim() || searchParams.get("trxref")?.trim() || "";
    if (!reference || verifyingRef.current) return;
    verifyingRef.current = true;

    void (async () => {
      toast.info("Confirming your payment…");
      try {
        const data = await verify.mutateAsync(reference);
        const status = String(data.transaction.status).toLowerCase();
        if (status === "completed") {
          toast.success("Wallet funded successfully.");
        } else if (status === "pending") {
          toast.info("Payment is still pending. It will update shortly.");
        } else {
          toast.error(`Payment status: ${status}`);
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Could not confirm payment."));
      } finally {
        setSearchParams({}, { replace: true });
        verifyingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for return URL params
  }, []);

  const transactions = useMemo(
    () => txQ.data?.pages.flatMap((p) => p.transactions) ?? [],
    [txQ.data],
  );

  const balance = walletQ.data?.balance ?? 0;
  const balanceLabel = walletQ.isPending
    ? "Loading…"
    : hideBalance
      ? "₦••••••"
      : formatNaira(balance);

  return (
    <div className="page wallet-page">
      <div className="page-header-row">
        <div>
          <Link to="/" className="profile-back">
            ← Back
          </Link>
          <h1>Wallet</h1>
        </div>
      </div>

      <section className="wallet-balance-card">
        <div className="wallet-balance-top">
          <span>Available balance</span>
          <button
            type="button"
            className="wallet-balance-toggle"
            aria-label={hideBalance ? "Show balance" : "Hide balance"}
            onClick={() => setHideBalance((v) => !v)}
          >
            <EyeIcon off={hideBalance} />
          </button>
        </div>
        <p className="wallet-balance-amount">{balanceLabel}</p>
        {walletQ.isError ? (
          <p className="wallet-balance-error">Couldn’t load balance.</p>
        ) : null}
      </section>

      <div className="wallet-actions">
        <button type="button" className="wallet-action" onClick={() => setFundOpen(true)}>
          <span className="wallet-action-icon" aria-hidden>
            +
          </span>
          Fund wallet
        </button>
        <button type="button" className="wallet-action" onClick={() => setWithdrawOpen(true)}>
          <span className="wallet-action-icon" aria-hidden>
            −
          </span>
          Withdraw
        </button>
      </div>

      <section className="wallet-tx-section">
        <div className="dash-section-head">
          <h2>Recent transactions</h2>
        </div>

        {txQ.isPending ? (
          <div className="wallet-tx-list" aria-busy="true" aria-label="Loading transactions">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="wallet-tx skeleton-row">
                <div className="wallet-tx-main">
                  <span className="skeleton skeleton-line skeleton-line-short" />
                  <span className="skeleton skeleton-line skeleton-line-mid" />
                </div>
                <span className="skeleton skeleton-line" style={{ width: 64, height: 14 }} />
              </div>
            ))}
          </div>
        ) : txQ.isError ? (
          <div className="dash-empty muted">
            Couldn’t load transactions.
            <button type="button" className="btn-ghost" onClick={() => void txQ.refetch()}>
              Retry
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="dash-empty">
            <strong>No transactions yet</strong>
            <p className="muted">Fund your wallet to see activity here.</p>
          </div>
        ) : (
          <>
            <div className="wallet-tx-list">
              {transactions.map((tx) => (
                <TxRow key={tx.id} tx={tx} onOpen={() => setSelectedTx(tx)} />
              ))}
            </div>
            {txQ.hasNextPage ? (
              <button
                type="button"
                className="btn-secondary wallet-load-more"
                disabled={txQ.isFetchingNextPage}
                onClick={() => void txQ.fetchNextPage()}
              >
                {txQ.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            ) : null}
          </>
        )}
      </section>

      {fundOpen ? <FundWalletModal onClose={() => setFundOpen(false)} /> : null}
      {withdrawOpen ? <WithdrawInfoModal onClose={() => setWithdrawOpen(false)} /> : null}
      {selectedTx ? (
        <WalletTransactionModal
          tx={selectedTx}
          onClose={() => setSelectedTx(null)}
          onRefreshed={() => {
            void walletQ.refetch();
            void txQ.refetch();
          }}
        />
      ) : null}
    </div>
  );
}
