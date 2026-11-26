/** Signup intent: personal requester vs business owner (same phone auth). */

const INTENT_KEY = "gq_signup_intent";

export type SignupIntent = "personal" | "business";

export function setSignupIntent(intent: SignupIntent): void {
  try {
    sessionStorage.setItem(INTENT_KEY, intent);
  } catch {
    /* private mode */
  }
}

export function getSignupIntent(): SignupIntent {
  try {
    return sessionStorage.getItem(INTENT_KEY) === "business" ? "business" : "personal";
  } catch {
    return "personal";
  }
}

export function clearSignupIntent(): void {
  try {
    sessionStorage.removeItem(INTENT_KEY);
  } catch {
    /* private mode */
  }
}

export function isBusinessSignupIntent(): boolean {
  return getSignupIntent() === "business";
}
