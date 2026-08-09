import axios from "axios";
import { clearSession, getToken } from "./auth";
import { config } from "./config";

export const http = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

http.interceptors.request.use((req) => {
  const token = getToken();
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearSession();
      const path = window.location.pathname;
      if (!path.startsWith("/login") && !path.startsWith("/signup") && !path.startsWith("/forgot-password")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined;
    return data?.error?.message || data?.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
