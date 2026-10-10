import { useEffect } from "react";
import { clearSession, isAuthenticated } from "../lib/auth";

/** Log out after this much idle time (mouse/keyboard/touch). */
const IDLE_MS = 30 * 60 * 1000;
const ACTIVITY_KEY = "gq_web_last_activity";
const CHECK_EVERY_MS = 60 * 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
];

function readLastActivity(): number | null {
  const raw = sessionStorage.getItem(ACTIVITY_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

let lastTouchWrite = 0;

function touchActivity(): void {
  const now = Date.now();
  // Avoid writing sessionStorage on every mousemove.
  if (now - lastTouchWrite < 15_000) return;
  lastTouchWrite = now;
  sessionStorage.setItem(ACTIVITY_KEY, String(now));
}

function expireSession(): void {
  if (!isAuthenticated()) return;
  clearSession();
  const path = window.location.pathname;
  if (
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password")
  ) {
    return;
  }
  window.location.href = "/login?reason=idle";
}

function isIdle(): boolean {
  const last = readLastActivity();
  if (last == null) return false;
  return Date.now() - last >= IDLE_MS;
}

/**
 * Ends the web session after prolonged inactivity. Closing the browser still
 * depends on Remember me (sessionStorage vs localStorage); this covers open tabs.
 */
export function SessionIdleGuard() {
  useEffect(() => {
    if (!isAuthenticated()) return;

    if (readLastActivity() == null) touchActivity();
    if (isIdle()) {
      expireSession();
      return;
    }

    let idleTimer: number | undefined;
    const schedule = () => {
      window.clearTimeout(idleTimer);
      const last = readLastActivity() ?? Date.now();
      const remaining = Math.max(0, IDLE_MS - (Date.now() - last));
      idleTimer = window.setTimeout(() => {
        if (isIdle()) expireSession();
      }, remaining + 250);
    };

    const onActivity = () => {
      touchActivity();
      schedule();
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (isIdle()) {
        expireSession();
        return;
      }
      touchActivity();
      schedule();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => {
      if (isIdle()) expireSession();
    }, CHECK_EVERY_MS);

    schedule();

    return () => {
      window.clearTimeout(idleTimer);
      window.clearInterval(interval);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
