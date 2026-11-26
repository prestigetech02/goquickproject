import type { NavigateFunction } from "react-router-dom";
import { clearSignupIntent, isBusinessSignupIntent } from "./businessAuth";
import { userOwnsBusiness, type User } from "../types/api";

/**
 * Single post-login / post-OTP destination rules.
 * Same login for personal and business — org membership decides next step.
 */
export function postAuthNavigate(navigate: NavigateFunction, user: User): void {
  if (user.role === "runner") {
    navigate("/get-app", { replace: true });
    return;
  }

  // Mid business signup: phone verified but org not created yet.
  if (isBusinessSignupIntent() && !userOwnsBusiness(user)) {
    navigate("/business/setup", { replace: true });
    return;
  }

  clearSignupIntent();
  // Business owners and personal requesters share the app shell for now.
  // When a dedicated business home exists, route owners there instead.
  navigate("/", { replace: true });
}
