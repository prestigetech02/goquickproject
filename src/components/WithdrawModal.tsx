import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../lib/http";
import {
  usePayoutAccountQuery,
  useRequestWithdrawalMutation,
  useWalletBanksQuery,
} from "../lib/queries";
import { resolvePayoutAccount, type PayoutAccount } from "../lib/walletApi";
import { formatNaira } from "../types/errand";
import { useToast } from "./ToastProvider";

const FALLBACK_FEE_PERCENT = 0.1;

type Props = {
  balance: number;
  onClose: () => void;
};

export function WithdrawModal({ balance, onClose }: Props) {
  const titleId = useId();
  const toast = useToast();
  const amountRef = useRef<HTMLInputElement>(null);
  const banksQ = useWalletBanksQuery(true);
  const rulesQ = usePayoutAccountQuery(true);
  const request = useRequestWithdrawalMutation();

  const feePercent = rulesQ.data?.fee_percent ?? FALLBACK_FEE_PERCENT;

  const [amount, setAmount] = useState("");
  const [bankQuery, setBankQuery] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [verified, setVerified] = useState<PayoutAccount | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<{
    amount: number;
    fee: number;
    bankName: string;
    accountName: string;
    accountNumber: string;
    reference: string;
  } | null>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    amountRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !request.isPending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, request.isPending]);

  useEffect(() => {
    const saved = rulesQ.data?.payout_account;
    if (prefilled.current || !saved?.bank_code || !saved.account_number) return;
    prefilled.current = true;
    setBankCode(saved.bank_code);
    setBankQuery(saved.bank_name ?? "");
    setAccountNumber(saved.account_number);
  }, [rulesQ.data]);

  const banks = banksQ.data ?? [];
  const selectedBank = banks.find((bank) => bank.code === bankCode) ?? null;
  const filteredBanks = useMemo(() => {
    const q = bankQuery.trim().toLowerCase();
    if (!q) return [];
    return banks.filter((bank) => bank.name.toLowerCase().includes(q)).slice(0, 12);
  }, [banks, bankQuery]);

  const digits = accountNumber.replace(/\D/g, "");

  useEffect(() => {
    if (!bankCode || digits.length < 10) {
      setVerified(null);
      setVerifyError(null);
      setVerifying(false);
      return;
    }

    let cancelled = false;
    setVerifying(true);
    setVerified(null);
    setVerifyError(null);
    const timer = window.setTimeout(() => {
      void resolvePayoutAccount({ bankCode, accountNumber: digits })
        .then((res) => {
          if (cancelled) return;
          if (!res.success || !res.data?.account_name) {
            setVerified(null);
            setVerifyError(res.error?.message ?? "Could not verify that account.");
            return;
          }
          setVerified(res.data);
          setVerifyError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setVerified(null);
          setVerifyError(getApiErrorMessage(err, "Could not verify that account."));
        })
        .finally(() => {
          if (!cancelled) setVerifying(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bankCode, digits]);

  const parsedAmount = Number(String(amount).replace(/,/g, ""));
  const fee =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? Math.round(parsedAmount * (feePercent / 100) * 100) / 100
      : 0;
  const total = parsedAmount + fee;
  const busy = request.isPending;

  function amountError(): string | null {
    if (!amount.trim()) return null;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return "Enter an amount greater than 0.";
    if (total > balance + 0.0001) {
      return `Insufficient balance. Total deduction is ${formatNaira(total)} including the ${feePercent}% fee.`;
    }
    return null;
  }

  const error = amountError();
  const accountReady = Boolean(verified?.account_name) && verified?.bank_code === bankCode && verified?.account_number === digits;

  function handleReview(e: FormEvent) {
    e.preventDefault();
    if (error) {
      toast.error(error);
      return;
    }
    if (verifying) return;
    if (!accountReady) {
      toast.error(verifyError ?? "Enter a bank and account number so we can verify the account name.");
      return;
    }
    setConfirming(true);
  }

  async function submit() {
    if (!verified) return;
    try {
      const data = await request.mutateAsync({
        amount: parsedAmount,
        bankCode,
        accountNumber: digits,
      });
      setDone({
        amount: Number(data.withdrawal.amount),
        fee: Number(data.withdrawal.fee),
        bankName: data.withdrawal.bank_name ?? verified.bank_name ?? selectedBank?.name ?? bankQuery,
        accountName: data.withdrawal.account_name ?? verified.account_name ?? "",
        accountNumber: data.withdrawal.account_number ?? digits,
        reference: data.withdrawal.reference ?? "",
      });
      setConfirming(false);
      toast.success("Withdrawal requested.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not request withdrawal."));
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="modal-panel wallet-withdraw-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <h2 id={titleId} className="notification-modal-title" style={{ margin: 0 }}>
            {done ? "Request sent" : confirming ? "Confirm withdrawal" : "Withdraw"}
          </h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose} disabled={busy}>
            ×
          </button>
        </div>

        {done ? (
          <div className="stack">
            <p className="muted wallet-fund-copy">
              {formatNaira(done.amount)} will be paid to {done.accountName} ({done.bankName} · {done.accountNumber}) after admin approval.
            </p>
            <div className="wallet-withdraw-summary">
              <SummaryRow label="Amount" value={formatNaira(done.amount)} />
              <SummaryRow label={`Fee (${feePercent}%)`} value={formatNaira(done.fee)} />
              {done.reference ? <SummaryRow label="Reference" value={done.reference} /> : null}
            </div>
            <p className="info">Withdrawals are processed within 24 hours, excluding weekends.</p>
            <div className="notification-modal-actions">
              <button type="button" className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : confirming && verified ? (
          <div className="stack">
            <div className="wallet-withdraw-summary">
              <SummaryRow label="Withdrawal amount" value={formatNaira(parsedAmount)} />
              <SummaryRow label={`Processing fee (${feePercent}%)`} value={formatNaira(fee)} />
              <SummaryRow label="Total deduction" value={formatNaira(total)} strong />
              <SummaryRow label="Bank" value={verified.bank_name ?? selectedBank?.name ?? bankQuery} />
              <SummaryRow label="Account name" value={verified.account_name ?? "—"} />
              <SummaryRow label="Account number" value={verified.account_number ?? digits} />
            </div>
            <p className="info">
              The amount and fee are held from your wallet now. Your account will be credited usually within 24 hours excluding weekends.
            </p>
            <div className="notification-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirming(false)} disabled={request.isPending}>
                Back
              </button>
              <button type="button" className="btn-primary" onClick={() => void submit()} disabled={request.isPending}>
                {request.isPending ? "Requesting…" : "Confirm"}
              </button>
            </div>
          </div>
        ) : (
          <form className="stack" onSubmit={handleReview}>
            <p className="muted wallet-fund-copy">
              Available {formatNaira(balance)}. A {feePercent}% fee is deducted with the amount. The bank account name must match the name on your account.
            </p>
            <label>
              <span className="label">Amount (₦)</span>
              <input
                ref={amountRef}
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
                required
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            {amount.trim() && !error ? (
              <div className="wallet-withdraw-summary">
                <SummaryRow label="Amount" value={formatNaira(parsedAmount)} />
                <SummaryRow label={`Fee (${feePercent}%)`} value={formatNaira(fee)} />
                <SummaryRow label="Total deduction" value={formatNaira(total)} strong />
              </div>
            ) : null}

            <div className="wallet-bank-field">
              <label>
                <span className="label">Bank</span>
                <input
                  type="text"
                  role="combobox"
                  aria-expanded={bankOpen}
                  aria-autocomplete="list"
                  autoComplete="off"
                  placeholder={banksQ.isPending ? "Loading banks…" : "Type to search banks"}
                  value={bankQuery}
                  onChange={(e) => {
                    setBankQuery(e.target.value);
                    setBankCode("");
                    setBankOpen(true);
                  }}
                  onFocus={() => {
                    if (bankQuery.trim()) setBankOpen(true);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setBankOpen(false), 150);
                  }}
                  disabled={busy || banksQ.isPending}
                  required
                />
              </label>
              {bankOpen && bankQuery.trim() ? (
                <ul className="wallet-bank-suggestions" role="listbox">
                  {filteredBanks.length === 0 ? (
                    <li>
                      <button type="button" disabled>
                        No banks match
                      </button>
                    </li>
                  ) : (
                    filteredBanks.map((bank) => (
                      <li key={bank.code}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={bank.code === bankCode}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setBankCode(bank.code);
                            setBankQuery(bank.name);
                            setBankOpen(false);
                          }}
                        >
                          {bank.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
            {banksQ.isError ? <p className="error">Couldn’t load banks. Close and try again.</p> : null}

            <label>
              <span className="label">Account number</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                placeholder="10-digit account number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 20))}
                disabled={busy}
                required
              />
            </label>
            {verifying ? <p className="muted">Checking account name…</p> : null}
            {verifyError ? <p className="error">{verifyError}</p> : null}
            {accountReady && verified?.account_name ? (
              <p className="info">
                Pays to <strong>{verified.account_name}</strong>
                {verified.bank_name ? ` · ${verified.bank_name}` : ""}
              </p>
            ) : null}

            <div className="notification-modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={busy || Boolean(error) || verifying || !accountReady}>
                Review
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="wallet-withdraw-row">
      <span>{label}</span>
      <strong style={strong ? undefined : { fontWeight: 600 }}>{value}</strong>
    </div>
  );
}
