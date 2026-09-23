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
