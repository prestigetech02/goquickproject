/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_PAYSTACK_PUBLIC_KEY: string;
  readonly VITE_PLAY_STORE_URL: string;
  readonly VITE_APP_STORE_URL: string;
  readonly VITE_LANDING_URL: string;
  readonly VITE_BROADCAST_DRIVER?: string;
  readonly VITE_PUSHER_APP_KEY: string;
  readonly VITE_PUSHER_APP_CLUSTER: string;
  readonly VITE_REVERB_APP_KEY?: string;
  readonly VITE_REVERB_HOST?: string;
  readonly VITE_REVERB_PORT?: string;
  readonly VITE_REVERB_SCHEME?: string;
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
