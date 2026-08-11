import { http } from "./http";
import type { ApiResponse, AuthPayload, User } from "../types/api";

export async function loginWithPhone(phone: string, password: string) {
  const { data } = await http.post<ApiResponse<AuthPayload>>("/user/login", {
    phone,
    password,
  });
  return data;
}

export async function sendOtp(phone: string) {
  const { data } = await http.post<ApiResponse<unknown>>("/auth/send-otp", { phone });
  return data;
}

export async function verifyOtp(phone: string, otp: string) {
  const { data } = await http.post<ApiResponse<AuthPayload>>("/auth/verify-otp", {
    phone,
    otp,
  });
  return data;
}

export async function logout() {
  try {
    await http.post("/auth/logout");
  } catch {
    // Clear local session even if API fails
  }
}

export async function setPassword(password: string, passwordConfirmation: string) {
  const { data } = await http.post<ApiResponse<{ user: User }>>("/user/set-password", {
    password,
    password_confirmation: passwordConfirmation,
  });
  return data;
}

export async function registerProfile(payload: {
  first_name: string;
  last_name: string;
  email: string;
  address: string;
  city: string;
  state: string;
  password?: string;
  referral_code?: string;
}) {
  const body: Record<string, string> = {
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    address: payload.address,
    city: payload.city,
    state: payload.state,
  };
  if (payload.password) body.password = payload.password;
  if (payload.referral_code) body.referral_code = payload.referral_code;

  const { data } = await http.post<ApiResponse<{ user: User }>>("/user/register", body);
  return data;
}

export async function fetchProfile() {
  const { data } = await http.get<ApiResponse<User>>("/user/profile");
  return data;
}

export async function sendPasswordReset(phone: string) {
  const { data } = await http.post<ApiResponse<unknown>>("/auth/password/reset", { phone });
  return data;
}

export async function confirmPasswordReset(payload: {
  phone: string;
  otp: string;
  password: string;
  password_confirmation: string;
}) {
  const { data } = await http.post<ApiResponse<unknown>>("/auth/password/reset/confirm", payload);
  return data;
}
