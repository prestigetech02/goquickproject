export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1",
  paystackPublicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "",
  playStoreUrl:
    import.meta.env.VITE_PLAY_STORE_URL ||
    "https://play.google.com/store/apps/details?id=com.goquick.app",
  appStoreUrl: import.meta.env.VITE_APP_STORE_URL || "https://apps.apple.com/app/goquick",
  landingUrl: import.meta.env.VITE_LANDING_URL || "https://goquickapp.com.ng",
  /** Set true to restore Invite & earn, referral codes, and related UI. */
  referralEnabled: false,
  /** Public Mapbox token for Mapbox GL JS (tiles only — never use the secret token here). */
  mapboxAccessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "",
  /** `pusher` (Pusher.com) or `reverb` (self-hosted Laravel Reverb). Must match backend BROADCAST_CONNECTION. */
  broadcastDriver: (import.meta.env.VITE_BROADCAST_DRIVER || "reverb").toLowerCase() as
    | "pusher"
    | "reverb",
  /** Pusher.com key — only when broadcastDriver is pusher */
  pusherKey: import.meta.env.VITE_PUSHER_APP_KEY || "",
  pusherCluster: import.meta.env.VITE_PUSHER_APP_CLUSTER || "mt1",
  /** Reverb app key (must match backend REVERB_APP_KEY) */
  reverbKey:
    import.meta.env.VITE_REVERB_APP_KEY ||
    import.meta.env.VITE_PUSHER_APP_KEY ||
    "demo_app_key_123456",
  reverbHost: import.meta.env.VITE_REVERB_HOST || "127.0.0.1",
  reverbPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
  reverbScheme: (import.meta.env.VITE_REVERB_SCHEME || "http").toLowerCase() as "http" | "https",
} as const;

/** API origin without `/api/v1` (for broadcasting auth, etc.). */
export function getApiRootUrl(): string {
  const base = config.apiBaseUrl.replace(/\/$/, "");
  if (base.endsWith("/api/v1")) return base.slice(0, -"/api/v1".length);
  return base;
}
