export type ErrandStatusFilter = "all" | "active" | "completed" | "cancelled";

export type ErrandRunner = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  profile_picture?: string | null;
  transport_mode?: string | null;
  average_rating?: number | null;
  total_reviews?: number | null;
  errands_count?: number | null;
  completed_errands?: number | null;
  current_location?: {
    latitude?: number | null;
    longitude?: number | null;
    updated_at?: string | null;
  } | null;
};

export type ErrandPayment = {
  status: string;
  amount: number;
  escrow?: {
    id: number;
    status: string;
    amount: number;
    held_at?: string | null;
    released_at?: string | null;
    refunded_at?: string | null;
  } | null;
};

export type ErrandCancellation = {
  applies: boolean;
  fee_percent: number;
  fee_amount: number;
  refund_amount: number;
  escrow_amount: number;
};

export type ErrandProof = {
  id: number;
  proof_photos?: string[] | null;
  notes?: string | null;
  status?: string | null;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
};

export type ErrandAttachment = {
  id: number;
  file_name?: string | null;
  file_type?: string | null;
  file_url?: string | null;
  file_size?: number | null;
};

export type ErrandDisputeType = "payment" | "service" | "other";

export type ErrandDispute = {
  id: number;
  type: ErrandDisputeType | string;
  reason: string;
  status: string;
  raised_by?: number | null;
  resolution?: string | null;
  resolved_at?: string | null;
};

export type CouponPreview = {
  valid: boolean;
  coupon_id?: number | null;
  code: string;
  name?: string | null;
  discount_type?: string | null;
  listed_amount: number;
  discount_amount: number;
  payable_amount: number;
  subsidy_amount: number;
  job_amount: number;
};

export type Errand = {
  id: number;
  title: string;
  description?: string | null;
  category?: string | null;
  status: string;
  budget_min?: number | null;
  budget_max?: number | null;
  base_price?: number | null;
  pickup_address?: string | null;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  dropoff_address?: string | null;
  dropoff_latitude?: number | null;
  dropoff_longitude?: number | null;
  estimated_distance_km?: number | null;
  estimated_duration_min?: number | null;
  runner_id?: number | null;
  runner?: ErrandRunner | null;
  payment?: ErrandPayment | null;
  cancellation?: ErrandCancellation | null;
  proof?: ErrandProof | null;
  attachments?: ErrandAttachment[] | null;
  dispute?: ErrandDispute | null;
  buyer_has_reviewed?: boolean;
  code?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  accepted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  metadata?: Record<string, unknown> | null;
  coupon?: CouponPreview | null;
  /** Flat buyer service fee (₦) from admin; added on top of offer/payable at payment. */
  service_fee?: number | null;
};

export type ErrandOffer = {
  id: number;
  errand_id: number;
  runner_id: number;
  amount: number;
  message?: string | null;
  status: string;
  initiated_by?: string | null;
  created_at?: string | null;
  runner?: {
    id: number;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    profile_picture?: string | null;
  } | null;
};

export type ErrandsListResult = {
  errands: Errand[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
  };
};

export function runnerDisplayName(runner?: ErrandRunner | ErrandOffer["runner"] | null): string {
  if (!runner) return "";
  const name = [runner.first_name, runner.last_name].filter(Boolean).join(" ").trim();
  return name || "Runner";
}

export function isLocationCompletionCategory(category?: string | null): boolean {
  const c = (category ?? "").toLowerCase();
  return c === "queue" || c === "domestic";
}

export function errandStatusLabel(status: string, category?: string | null): string {
  const s = status.toLowerCase();
  const cat = (category ?? "").toLowerCase();
  if (isLocationCompletionCategory(cat)) {
    switch (s) {
      case "pending":
      case "searching":
      case "draft":
        return "Errand submitted";
      case "accepted":
        return "Runner assigned";
      case "on_my_way":
        return "On the way";
      case "arrived":
      case "in_progress":
        return cat === "queue" ? "At queue location" : "At errand location";
      case "delayed":
        return "Delayed";
      case "waiting_for_buyer":
        return "Awaiting you";
      case "completed":
      case "delivered":
        return "Errand completed";
      case "cancelled":
      case "cancelled_by_buyer":
      case "cancelled_by_runner":
        return "Cancelled";
      case "failed":
        return "Failed";
      case "disputed":
        return "Disputed";
      default:
        return status.replace(/_/g, " ");
    }
  }
  switch (s) {
    case "pending":
    case "searching":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "on_my_way":
      return "In delivery";
    case "arrived":
      return "At pickup";
    case "in_progress":
      return "In progress";
    case "delayed":
      return "Delayed";
    case "waiting_for_buyer":
      return "Awaiting you";
    case "completed":
    case "delivered":
      return "Delivered";
    case "cancelled":
    case "cancelled_by_buyer":
    case "cancelled_by_runner":
      return "Cancelled";
    case "failed":
      return "Failed";
    case "disputed":
      return "Disputed";
    default:
      return status.replace(/_/g, " ");
  }
}

export function errandStatusTone(status: string): "muted" | "warn" | "ok" | "danger" {
  const s = status.toLowerCase();
  if (s === "completed" || s === "delivered") return "ok";
  if (
    s === "cancelled" ||
    s === "cancelled_by_buyer" ||
    s === "cancelled_by_runner" ||
    s === "failed" ||
    s === "disputed"
  ) {
    return "danger";
  }
  if (s === "in_progress" || s === "on_my_way" || s === "delayed" || s === "arrived") return "warn";
  return "muted";
}

export function canCancelErrand(status: string): boolean {
  return ["searching", "pending", "accepted", "on_my_way", "arrived"].includes(
    status.toLowerCase(),
  );
}

export function proofStatusLabel(status: string | null | undefined): string {
  switch ((status || "pending").toLowerCase()) {
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "pending":
      return "Pending review";
    default:
      return String(status).replace(/_/g, " ");
  }
}

/** Buyer can accept/reject while proof is pending, or after they rejected it. */
export function canActOnProof(errand: Errand): boolean {
  if (!errand.proof) return false;
  const proofStatus = (errand.proof.status || "pending").toLowerCase();
  if (proofStatus === "accepted") return false;
  const status = errand.status.toLowerCase();
  if (status === "completed") return true;
  return status === "in_progress" || status === "delayed";
}

/** Buyer can rate runner after completion if they have not reviewed yet. */
export function canReviewRunner(errand: Errand): boolean {
  return errand.status.toLowerCase() === "completed" && !errand.buyer_has_reviewed;
}

export const DISPUTE_TYPES: { value: ErrandDisputeType; label: string; description: string }[] = [
  { value: "payment", label: "Payment issue", description: "Problems with payment or escrow" },
  { value: "service", label: "Service issue", description: "Problems with how the errand was done" },
  { value: "other", label: "Other", description: "Something else that needs support" },
];

export function disputeTypeLabel(type: string): string {
  return DISPUTE_TYPES.find((item) => item.value === type)?.label ?? type.replace(/_/g, " ");
}

export function disputeStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case "open":
      return "Open";
    case "under_review":
      return "Under review";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return status.replace(/_/g, " ");
  }
}

/** Requester can dispute once a runner is on the job, until it is cancelled or already in dispute. */
export function canRaiseDispute(errand: Errand): boolean {
  const status = errand.status.toLowerCase();
  if (status.startsWith("cancelled") || status === "failed" || status === "disputed") return false;
  if (status === "draft" || status === "searching" || status === "pending") return false;
  if (!errand.runner_id) return false;
  const disputeStatus = errand.dispute?.status?.toLowerCase();
  if (disputeStatus === "open" || disputeStatus === "under_review") return false;
  return true;
}

export function formatNaira(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  return `₦${Number(amount).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function positiveAmount(value: number | null | undefined): number | null {
  if (value == null) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function parseCouponPreview(raw: unknown): CouponPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const json = raw as Record<string, unknown>;
  const listed = positiveAmount(Number(json.listed_amount ?? json.job_amount)) ?? 0;
  const discount = Number(json.discount_amount);
  const payable = Number(json.payable_amount);
  return {
    valid: json.valid !== false,
    coupon_id:
      json.coupon_id != null
        ? Number(json.coupon_id)
        : json.id != null
          ? Number(json.id)
          : null,
    code: String(json.code ?? "").trim(),
    name: typeof json.name === "string" ? json.name : null,
    discount_type: typeof json.discount_type === "string" ? json.discount_type : null,
    listed_amount: listed,
    discount_amount: Number.isFinite(discount) ? discount : 0,
    payable_amount: Number.isFinite(payable) && payable > 0 ? payable : listed,
    subsidy_amount: Number(json.subsidy_amount) || (Number.isFinite(discount) ? discount : 0),
    job_amount: Number(json.job_amount) || listed,
  };
}

/** Listed job price. Coupon listed is preferred so escrow (payable) is not shown as the job amount. */
export function errandDisplayAmount(errand: Errand): number | null {
  return (
    positiveAmount(errand.coupon?.listed_amount) ??
    positiveAmount(errand.payment?.amount) ??
    positiveAmount(errand.base_price) ??
    positiveAmount(errand.budget_min) ??
    positiveAmount(errand.budget_max)
  );
}

export function errandPayableAmount(errand: Errand): number | null {
  return positiveAmount(errand.coupon?.payable_amount) ?? errandDisplayAmount(errand);
}
