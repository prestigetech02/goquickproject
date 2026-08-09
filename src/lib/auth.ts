import type { User } from "../types/api";
import { queryClient } from "./queryClient";

const TOKEN_KEY = "gq_web_token";
const USER_KEY = "gq_web_user";
const REMEMBER_KEY = "gq_web_remember";

function readRememberPreference(): boolean {
  const stored = localStorage.getItem(REMEMBER_KEY);
  // Default to remembering when unset (existing sessions used localStorage)
  return stored !== "0";
}

export function getRememberMe(): boolean {
  return readRememberPreference();
}

export function setRememberMe(remember: boolean): void {
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, remember = readRememberPreference()): void {
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(TOKEN_KEY);
  store.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User, remember = readRememberPreference()): void {
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(USER_KEY);
  store.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function clearSession(): void {
  clearToken();
  clearStoredUser();
  queryClient.clear();
  void import("./echo").then((m) => m.disconnectEcho());
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/** Persist session after login / OTP verify. */
export function establishSession(token: string, user: User, remember = true): void {
  setRememberMe(remember);
  setToken(token, remember);
  setStoredUser(user, remember);
}
