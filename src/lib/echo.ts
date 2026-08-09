import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { getToken } from "./auth";
import { config, getApiRootUrl } from "./config";

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

window.Pusher = Pusher;

let echoInstance: Echo<"pusher"> | null = null;
let echoToken: string | null = null;

function broadcastKey(): string {
  if (config.broadcastDriver === "reverb") {
    return config.reverbKey || config.pusherKey;
  }
  return config.pusherKey;
}

/** Shared Laravel Echo client. Recreated when the auth token changes. */
export function getEcho(): Echo<"pusher"> | null {
  const token = getToken();
  const key = broadcastKey();
  if (!token || !key) return null;

  if (echoInstance && echoToken === token) return echoInstance;

  if (echoInstance) {
    try {
      echoInstance.disconnect();
    } catch {
      // ignore
    }
    echoInstance = null;
  }

  echoToken = token;

  const auth = {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  };

  if (config.broadcastDriver === "reverb") {
    const forceTLS = config.reverbScheme === "https";
    echoInstance = new Echo({
      broadcaster: "pusher",
      key,
      wsHost: config.reverbHost,
      wsPort: config.reverbPort,
      wssPort: config.reverbPort,
      forceTLS,
      enabledTransports: ["ws", "wss"],
      disableStats: true,
      cluster: "mt1",
      authEndpoint: `${getApiRootUrl()}/broadcasting/auth`,
      auth,
    });
  } else {
    echoInstance = new Echo({
      broadcaster: "pusher",
      key,
      cluster: config.pusherCluster,
      forceTLS: true,
      authEndpoint: `${getApiRootUrl()}/broadcasting/auth`,
      auth,
    });
  }

  return echoInstance;
}

export function disconnectEcho(): void {
  if (echoInstance) {
    try {
      echoInstance.disconnect();
    } catch {
      // ignore
    }
    echoInstance = null;
    echoToken = null;
  }
}
