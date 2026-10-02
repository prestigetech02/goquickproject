import { http } from "./http";
import type { ApiResponse } from "../types/api";

export type WalletInfo = {
  id: number;
  balance: number;
  currency: string;
};

export type WalletTxType = "credit" | "debit";
export type WalletTxStatus = "pending" | "completed" | "failed" | "reversed";

export type WalletTransaction = {
  id: number;
  wallet_id: number;
  errand_id?: number | null;
  type: WalletTxType | string;
  amount: number;
  status: WalletTxStatus | string;
  reference?: string | null;
  description?: string | null;
  display_title?: string | null;
  display_subtitle?: string | null;
  errand_code?: string | null;
  errand_category?: string | null;
  meta?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type WalletTransactionsResult = {
  transactions: WalletTransaction[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
  };
};

export type FundWalletResult = {
  transaction: WalletTransaction;
  reference: string;
  authorization_url: string | null;
  access_code?: string | null;
};

export async function fetchWallet() {
  const { data } = await http.get<ApiResponse<{ wallet: WalletInfo }>>("/wallet");
  if (!data.success || !data.data?.wallet) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to load wallet" },
    };
  }
  return {
    success: true as const,
    data: data.data.wallet,
  };
}

export async function fetchWalletTransactions(params?: {
  type?: WalletTxType;
  status?: WalletTxStatus;
  page?: number;
  perPage?: number;
}) {
  const { data } = await http.get<ApiResponse<WalletTransactionsResult>>("/wallet/transactions", {
    params: {
      type: params?.type,
      status: params?.status,
      page: params?.page ?? 1,
      per_page: params?.perPage ?? 20,
    },
  });
  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to load transactions" },
    };
  }
  return {
    success: true as const,
    data: data.data,
  };
}

export async function fundWallet(payload: {
  amount: number;
  email?: string;
  reference?: string;
  callbackUrl?: string;
}) {
  const { data } = await http.post<ApiResponse<FundWalletResult>>("/wallet/fund", {
    amount: payload.amount,
    email: payload.email,
    reference: payload.reference,
    callback_url: payload.callbackUrl,
  });
  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to start funding" },
    };
  }
  return {
    success: true as const,
    data: data.data,
    message: data.message,
  };
}

export async function verifyWalletFunding(reference: string) {
  const { data } = await http.get<
    ApiResponse<{ transaction: WalletTransaction; wallet_balance: number }>
  >(`/wallet/fund/verify/${encodeURIComponent(reference)}`);
  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to verify payment" },
    };
  }
  return {
    success: true as const,
    data: data.data,
  };
}

export type BankOption = {
  code: string;
  name: string;
};

export type PayoutAccount = {
  bank_name: string | null;
  bank_code: string | null;
  account_number: string | null;
  account_name: string | null;
};

export type WithdrawalAvailability = {
  enabled: boolean;
  message: string | null;
};

export type WithdrawalRules = {
  payout_account: PayoutAccount | null;
  minimum_amount: number;
  fee_percent: number;
  withdrawals?: WithdrawalAvailability;
};

export type WithdrawalRecord = {
  id: number;
  amount: number;
  fee: number | null;
  status: string;
  bank_name: string | null;
  bank_code: string | null;
  account_number: string | null;
  account_name: string | null;
  reference: string | null;
  reason: string | null;
  created_at: string | null;
};

export type WithdrawalRequestResult = {
  withdrawal: {
    id: number;
    amount: number;
    fee: number;
    total_deduction: number;
    status: string;
    bank_name: string | null;
    account_number: string | null;
    account_name: string | null;
    reference: string | null;
  };
  wallet_balance: number;
};

export async function fetchBanks() {
  const { data } = await http.get<ApiResponse<{ banks: BankOption[] }>>("/wallet/banks");
  if (!data.success || !data.data?.banks) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to load banks" },
    };
  }
  return { success: true as const, data: data.data.banks };
}

export async function fetchPayoutAccount() {
  const { data } = await http.get<ApiResponse<WithdrawalRules>>("/wallet/payout-account");
  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to load payout account" },
    };
  }
  return { success: true as const, data: data.data };
}

export async function resolvePayoutAccount(payload: { bankCode: string; accountNumber: string }) {
  const { data } = await http.post<ApiResponse<PayoutAccount>>("/wallet/payout-account/resolve", {
    bank_code: payload.bankCode,
    account_number: payload.accountNumber,
  });
  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Could not verify that account" },
    };
  }
  return { success: true as const, data: data.data };
}

export async function requestWithdrawal(payload: {
  amount: number;
  bankCode: string;
  accountNumber: string;
}) {
  const { data } = await http.post<ApiResponse<WithdrawalRequestResult>>("/wallet/withdrawals", {
    amount: payload.amount,
    bank_code: payload.bankCode,
    account_number: payload.accountNumber,
  });
  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Could not request withdrawal" },
      message: data.message,
    };
  }
  return { success: true as const, data: data.data, message: data.message };
}

export async function fetchWithdrawals(params?: { page?: number; perPage?: number }) {
  const { data } = await http.get<
    ApiResponse<{
      withdrawals: WithdrawalRecord[];
      pagination: { current_page: number; total_pages: number; total_items: number };
    }>
  >("/wallet/withdrawals", {
    params: { page: params?.page ?? 1, per_page: params?.perPage ?? 10 },
  });
  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to load withdrawals" },
    };
  }
  return { success: true as const, data: data.data };
}

export function walletTxLabel(tx: WalletTransaction): string {
  const title = tx.display_title?.trim();
  if (title) return title;
  const desc = tx.description?.trim();
  if (desc) return desc;
  return tx.type === "credit" ? "Credit" : "Debit";
}

export function walletTxSubtitle(tx: WalletTransaction): string {
  const coupon = couponSubtitle(tx);
  const fromApi = tx.display_subtitle?.trim();
  if (fromApi) {
    if (coupon && !fromApi.toLowerCase().includes("coupon")) return `${fromApi} · ${coupon}`;
    return fromApi;
  }
  if (tx.errand_code) {
    return coupon ? `Errand #${tx.errand_code} · ${coupon}` : `Errand #${tx.errand_code}`;
  }
  return coupon;
}

function couponSubtitle(tx: WalletTransaction): string {
  const meta = tx.meta;
  if (!meta) return "";
  const code = String(meta.coupon_code ?? "").trim();
  if (!code) return "";
  const raw = meta.coupon_discount_amount;
  const amount = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return `Coupon ${code}`;
  const formatted = amount === Math.round(amount) ? String(amount) : amount.toFixed(2);
  return `Coupon ${code} · −₦${formatted}`;
}

export function walletTxTone(tx: WalletTransaction): "ok" | "warn" | "danger" | "muted" {
  const status = String(tx.status).toLowerCase();
  if (status === "completed") return tx.type === "credit" ? "ok" : "muted";
  if (status === "pending") return "warn";
  if (status === "failed" || status === "reversed") return "danger";
  return "muted";
}
