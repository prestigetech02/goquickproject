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

export type NotificationSettings = {
  push_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
  errand_updates: boolean;
  chat_messages: boolean;
  payouts: boolean;
  promotions: boolean;
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
};

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
  notification_settings?: NotificationSettings;
  referral?: UserReferral;
};

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

/** Name + address fields needed before posting errands / payments */
export function isProfileComplete(user: User | null | undefined): boolean {
  if (!user) return false;
  return !!(
    user.first_name?.trim() &&
    user.last_name?.trim() &&
    user.address?.trim() &&
    user.city?.trim() &&
    user.state?.trim()
  );
}
