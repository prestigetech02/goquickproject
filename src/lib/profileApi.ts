import { http } from "./http";
import type { ApiResponse, NotificationSettings, User } from "../types/api";

export type ProfileUpdatePayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
};

export async function updateProfile(payload: ProfileUpdatePayload) {
  const { data } = await http.put<ApiResponse<{ user: Partial<User> }>>(
    "/user/profile",
    payload,
  );
  return data;
}

export async function uploadProfilePicture(
  file: File,
  onProgress?: (percent: number) => void,
) {
  const form = new FormData();
  form.append("profile_picture", file);
  const { data } = await http.post<ApiResponse<{ profile_picture: string }>>(
    "/user/profile-picture",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!onProgress) return;
        if (!event.total || event.total <= 0) {
          onProgress(event.loaded > 0 ? 90 : 0);
          return;
        }
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(percent);
      },
    },
  );
  onProgress?.(100);
  return data;
}

export async function changePassword(payload: {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}) {
  const { data } = await http.post<ApiResponse<unknown>>("/user/change-password", payload);
  return data;
}

export async function fetchNotificationSettings() {
  const { data } = await http.get<ApiResponse<NotificationSettings>>(
    "/user/notification-settings",
  );
  return data;
}

export async function updateNotificationSettings(payload: Partial<NotificationSettings>) {
  const { data } = await http.put<ApiResponse<NotificationSettings>>(
    "/user/notification-settings",
    payload,
  );
  return data;
}

export async function registerWebFcmToken(fcmToken: string) {
  const { data } = await http.post<ApiResponse<unknown>>("/user/web-fcm-token", {
    fcm_token: fcmToken,
  });
  return data;
}

export async function clearWebFcmToken() {
  const { data } = await http.delete<ApiResponse<unknown>>("/user/web-fcm-token");
  return data;
}

export async function deactivateAccount(password: string) {
  const { data } = await http.post<ApiResponse<unknown>>("/user/deactivate-account", {
    password,
  });
  return data;
}

export async function deleteAccount(password: string, reason?: string) {
  const { data } = await http.post<ApiResponse<unknown>>("/user/delete-account", {
    password,
    reason: reason || undefined,
  });
  return data;
}

export type ReferralHistoryItem = {
  user_name?: string;
  created_at?: string;
  reward_label?: string;
};

export type ReferralStatsPoint = {
  label?: string;
  value?: number;
};

export type ReferralData = {
  referral_code?: string | null;
  history?: ReferralHistoryItem[];
  stats?: ReferralStatsPoint[];
  totals?: {
    referred_requesters?: number;
    referred_runners?: number;
  };
  rewards?: {
    requester_discount_amount?: number;
    referrer_bonus_amount?: number;
  };
};

export async function fetchReferral(days = 7) {
  const { data } = await http.get<ApiResponse<ReferralData>>("/user/referral", {
    params: { days },
  });
  return data;
}
