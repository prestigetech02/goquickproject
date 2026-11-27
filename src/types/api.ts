export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

export type UserRole = "buyer" | "runner" | "admin";

/** Business membership returned on auth/profile (MVP: owner only). */
export type OrganizationSummary = {
  id: number;
  /** Public org id, e.g. GQORG00001 — shown to partners and in profile. */
  code?: string;
  name: string;
  slug: string;
  status: "pending" | "active" | "suspended" | string;
  /** managed = ops dispatch; marketplace = open runner feed. */
  fulfillment_mode?: "managed" | "marketplace" | string;
  /** Admin must enable before owners can mint Partner API keys. */
  partner_api_enabled?: boolean;
  /** QoreID KYB — identity_verified/verified allows dashboard; org may still be pending. */
  kyb_status?: string;
  kyb_address_status?: string;
  kyb_failure_reason?: string | null;
  role: "owner" | "admin" | "dispatcher" | "viewer" | string;
  contact_phone?: string | null;
  contact_email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  cac_number?: string | null;
  created_at?: string | null;
};

export type NotificationSettings = {
  push_enabled: boolean;
  email_enabled: boolean;
  errand_updates: boolean;
  chat_messages: boolean;
  payouts: boolean;
  promotions: boolean;
};

export type SavedPlace = {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  place_id?: string | null;
};

export type UserReferral = {
  referral_code?: string | null;
  requester?: {
    has_used_discount?: boolean;
    remaining_discounts?: number;
  };
  runner?: {
    remaining_zero_commission_jobs?: number;
    remaining_referrer_discount_jobs?: number;
  };
  totals?: {
    referred_requesters?: number;
    referred_runners?: number;
  };
  rewards?: {
    requester_discount_amount?: number;
    referrer_bonus_amount?: number;
  };
  copy?: {
    screen_message?: string;
    share_message?: string;
  };
};

export function referralReferrerBonus(referral?: UserReferral | null, fallback = 1000): number {
  const amount = Number(referral?.rewards?.referrer_bonus_amount);
  return Number.isFinite(amount) && amount > 0 ? amount : fallback;
}

export function referralRequesterDiscount(referral?: UserReferral | null, fallback = 500): number {
  const amount = Number(referral?.rewards?.requester_discount_amount);
  return Number.isFinite(amount) && amount > 0 ? amount : fallback;
}

export type User = {
  id: number;
  phone: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  role: UserRole;
  is_verified?: boolean;
  phone_verified?: boolean;
  profile_picture?: string | null;
  /** False after OTP until web set-password step completes */
  has_password?: boolean;
  /** Business orgs this user belongs to (empty for personal-only accounts). */
  organizations?: OrganizationSummary[];
  notification_settings?: NotificationSettings;
  referral?: UserReferral;
  saved_places?: SavedPlace[];
};

export function userOwnsBusiness(user: User | null | undefined): boolean {
  return (user?.organizations ?? []).some((org) => org.role === "owner");
}

export function userHasBusiness(user: User | null | undefined): boolean {
  return (user?.organizations?.length ?? 0) > 0;
}

export type AuthPayload = {
  token: string;
  user: User;
};

export function hasPassword(user: User | null | undefined): boolean {
  if (!user) return false;
  if (typeof user.has_password === "boolean") return user.has_password;
  // Legacy sessions before has_password existed — treat as set
  return true;
}

/** Name + address + email needed before posting errands / payments */
export function isProfileComplete(user: User | null | undefined): boolean {
  if (!user) return false;
  return !!(
    user.first_name?.trim() &&
    user.last_name?.trim() &&
    user.email?.trim() &&
    user.address?.trim() &&
    user.city?.trim() &&
    user.state?.trim()
  );
}
