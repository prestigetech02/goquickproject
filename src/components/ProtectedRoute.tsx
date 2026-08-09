import { Navigate, Outlet } from "react-router-dom";
import { getStoredUser, isAuthenticated } from "../lib/auth";
import { hasPassword, isProfileComplete } from "../types/api";

export { isProfileComplete, hasPassword };

/** App shell: needs auth + password. Incomplete profile is allowed (soft gate). */
export function ProtectedRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const user = getStoredUser();
  if (!hasPassword(user)) {
    return <Navigate to="/set-password" replace />;
  }
  if (user?.role === "runner") {
    return <Navigate to="/get-app" replace />;
  }

  return <Outlet />;
}

/** Mid-signup steps that require a token (set password / complete profile). */
export function AuthOnlyRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/signup" replace />;
  }
  return <Outlet />;
}

/** Guest pages: bounce signed-in users into the right next step. */
export function GuestRoute() {
  if (isAuthenticated()) {
    const user = getStoredUser();
    if (!hasPassword(user)) {
      return <Navigate to="/set-password" replace />;
    }
    if (user?.role === "runner") {
      return <Navigate to="/get-app" replace />;
    }
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

/** set-password: only when password is missing */
export function SetPasswordRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/signup" replace />;
  }
  const user = getStoredUser();
  if (hasPassword(user)) {
    if (user?.role === "runner") {
      return <Navigate to="/get-app" replace />;
    }
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

/** complete-profile: needs password; skip if already complete */
export function CompleteProfileRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/signup" replace />;
  }
  const user = getStoredUser();
  if (!hasPassword(user)) {
    return <Navigate to="/set-password" replace />;
  }
  if (isProfileComplete(user)) {
    if (user?.role === "runner") {
      return <Navigate to="/get-app" replace />;
    }
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
