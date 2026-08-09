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

export async function uploadProfilePicture(file: File) {
  const form = new FormData();
  form.append("profile_picture", file);
  const { data } = await http.post<ApiResponse<{ profile_picture: string }>>(
    "/user/profile-picture",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
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
