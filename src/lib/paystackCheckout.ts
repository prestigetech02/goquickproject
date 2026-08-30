import type { FundWalletResult, WalletTransaction } from "./walletApi";

type PaystackCallbacks = {
  onSuccess?: (tranx: { reference?: string }) => void;
  onCancel?: () => void;
  onError?: (error: { message?: string }) => void;
};

type PaystackPopInstance = {
  resumeTransaction?: (accessCode: string, callbacks?: PaystackCallbacks) => void;
  setup?: (opts: Record<string, unknown>) => { openIframe: () => void };
};

declare global {
  interface Window {
    PaystackPop?: (new () => PaystackPopInstance) & PaystackPopInstance;
  }
}

const PAYSTACK_V2 = "https://js.paystack.co/v2/inline.js";

let scriptPromise: Promise<void> | null = null;

function loadPaystackScript(): Promise<void> {
  if (window.PaystackPop) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PAYSTACK_V2}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Paystack.")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = PAYSTACK_V2;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load Paystack."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Amount to send to Paystack so wallet reaches `required`. 0 if already covered. */
export function shortfallToFund(required: number, balance: number): number {
  const gap = Math.round((required - balance) * 100) / 100;
  if (gap <= 0) return 0;
  return Math.max(1, gap);
}

export function isFundingCompleted(tx: WalletTransaction): boolean {
  return String(tx.status).toLowerCase() === "completed";
}

async function openAuthorizationPopup(authorizationUrl: string): Promise<"success" | "cancelled"> {
  const child = window.open(authorizationUrl, "goquick_paystack", "popup=yes,width=480,height=720");
  if (!child) {
    window.location.assign(authorizationUrl);
    return new Promise(() => {
      /* page is navigating away */
    });
  }
  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      if (child.closed) {
        window.clearInterval(timer);
        resolve("success");
      }
    }, 400);
  });
}

async function resumeInline(accessCode: string): Promise<"success" | "cancelled" | "unavailable"> {
  try {
    await loadPaystackScript();
  } catch {
    return "unavailable";
  }
  const Pop = window.PaystackPop;
  if (!Pop) return "unavailable";

  return new Promise((resolve) => {
    try {
      const instance: PaystackPopInstance =
        typeof Pop === "function" ? new (Pop as new () => PaystackPopInstance)() : Pop;
      if (typeof instance.resumeTransaction !== "function") {
        resolve("unavailable");
        return;
      }
      let settled = false;
      const finish = (result: "success" | "cancelled") => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      instance.resumeTransaction(accessCode, {
        onSuccess: () => finish("success"),
        onCancel: () => finish("cancelled"),
        onError: () => finish("cancelled"),
      });
    } catch {
      resolve("unavailable");
    }
  });
}

export async function openPaystackCheckout(opts: {
  accessCode?: string | null;
  authorizationUrl: string;
}): Promise<"success" | "cancelled"> {
  if (opts.accessCode) {
    const inline = await resumeInline(opts.accessCode);
    if (inline !== "unavailable") return inline;
  }
  return openAuthorizationPopup(opts.authorizationUrl);
}

export async function completePaystackWalletFunding(opts: {
  amount: number;
  email: string;
  callbackUrl?: string;
  fund: (payload: {
    amount: number;
    email?: string;
    callbackUrl?: string;
  }) => Promise<FundWalletResult>;
  verify: (reference: string) => Promise<{
    transaction: WalletTransaction;
    wallet_balance: number;
  }>;
}): Promise<{ wallet_balance: number; reference: string }> {
  const funded = await opts.fund({
    amount: opts.amount,
    email: opts.email,
    callbackUrl: opts.callbackUrl,
  });
  if (!funded.authorization_url) {
    throw new Error("Payment link was not returned. Try again.");
  }

  const checkout = await openPaystackCheckout({
    accessCode: funded.access_code,
    authorizationUrl: funded.authorization_url,
  });
  if (checkout === "cancelled") {
    throw new Error("Payment was cancelled.");
  }

  let lastError: unknown = null;
  for (let i = 0; i < 8; i += 1) {
    try {
      const last = await opts.verify(funded.reference);
      if (isFundingCompleted(last.transaction)) {
        return { wallet_balance: last.wallet_balance, reference: funded.reference };
      }
    } catch (err) {
      lastError = err;
    }
    await sleep(1200);
  }

  if (lastError) throw lastError;
  throw new Error(
    "Payment is still pending. Check your wallet in a moment, then try again.",
  );
}
