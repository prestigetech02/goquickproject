export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1",
  paystackPublicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "",
  playStoreUrl:
    import.meta.env.VITE_PLAY_STORE_URL ||
    "https://play.google.com/store/apps/details?id=com.goquick.app",
  appStoreUrl: import.meta.env.VITE_APP_STORE_URL || "https://apps.apple.com/app/goquick",
  landingUrl: import.meta.env.VITE_LANDING_URL || "https://goquickapp.com.ng",
  /** Public Mapbox token for Mapbox GL JS (tiles only — never use the secret token here). */
  mapboxAccessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "",
  /** `pusher` (Pusher.com) or `reverb` (self-hosted Laravel Reverb). Must match backend BROADCAST_CONNECTION. */
  broadcastDriver: (import.meta.env.VITE_BROADCAST_DRIVER || "pusher").toLowerCase() as
    | "pusher"
    | "reverb",
  /** Pusher.com key — matches mobile AppConfig when using cloud broadcasting */
  pusherKey: import.meta.env.VITE_PUSHER_APP_KEY || "e6ac4473f96dc5689d26",
  pusherCluster: import.meta.env.VITE_PUSHER_APP_CLUSTER || "mt1",
  /** Reverb app key (often same as PUSHER_APP_KEY / REVERB_APP_KEY on backend) */
  reverbKey: import.meta.env.VITE_REVERB_APP_KEY || import.meta.env.VITE_PUSHER_APP_KEY || "",
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
