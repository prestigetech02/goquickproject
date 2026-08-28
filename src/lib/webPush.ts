import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from "firebase/messaging";
import { config } from "./config";
import { clearWebFcmToken, registerWebFcmToken } from "./profileApi";

let firebaseApp: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

export type WebPushPermissionState = "granted" | "denied" | "default" | "unsupported" | "unconfigured";

export function isWebPushConfigured(): boolean {
  return Boolean(
    config.firebase.apiKey &&
      config.firebase.projectId &&
      config.firebase.messagingSenderId &&
      config.firebase.appId &&
      config.firebase.vapidKey,
  );
}

export async function getWebPushPermissionState(): Promise<WebPushPermissionState> {
  if (!isWebPushConfigured()) return "unconfigured";
  if (!(await isWebPushSupported())) return "unsupported";
  return Notification.permission as WebPushPermissionState;
}

export async function isWebPushSupported(): Promise<boolean> {
  if (!isWebPushConfigured()) return false;
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

function getFirebaseOptions(): FirebaseOptions {
  return {
    apiKey: config.firebase.apiKey,
    authDomain: config.firebase.authDomain,
    projectId: config.firebase.projectId,
    messagingSenderId: config.firebase.messagingSenderId,
    appId: config.firebase.appId,
  };
}

function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    const existing = getApps();
    firebaseApp = existing.length > 0 ? existing[0]! : initializeApp(getFirebaseOptions());
  }
  return firebaseApp;
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (serviceWorkerRegistration) return serviceWorkerRegistration;
  if (!("serviceWorker" in navigator)) return null;

  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;
    return serviceWorkerRegistration;
  } catch (error) {
    console.warn("Web push service worker registration failed", error);
    return null;
  }
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (!(await isWebPushSupported())) return null;
  const registration = await ensureServiceWorker();
  if (!registration) return null;

  if (!messagingInstance) {
    messagingInstance = getMessaging(getFirebaseApp());
  }

  return messagingInstance;
}

export async function requestWebPushPermission(): Promise<WebPushPermissionState> {
  if (!(await isWebPushSupported())) {
    return isWebPushConfigured() ? "unsupported" : "unconfigured";
  }

  const permission = await Notification.requestPermission();
  return permission as WebPushPermissionState;
}

export async function syncWebPushToken(): Promise<boolean> {
  if (!(await isWebPushSupported())) return false;
  if (Notification.permission !== "granted") return false;

  const messaging = await getMessagingInstance();
  if (!messaging) return false;

  const registration = await ensureServiceWorker();
  if (!registration) return false;

  try {
    const token = await getToken(messaging, {
      vapidKey: config.firebase.vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) return false;

    const res = await registerWebFcmToken(token);
    return Boolean(res.success);
  } catch (error) {
    console.warn("Failed to sync web push token", error);
    return false;
  }
}

export async function enableWebPush(): Promise<{
  ok: boolean;
  permission: WebPushPermissionState;
}> {
  const permission = await requestWebPushPermission();
  if (permission !== "granted") {
    return { ok: false, permission };
  }

  const synced = await syncWebPushToken();
  return { ok: synced, permission };
}

export async function disableWebPush(): Promise<void> {
  try {
    await clearWebFcmToken();
  } catch (error) {
    console.warn("Failed to clear web push token", error);
  }
}

export async function bindForegroundPushHandler(
  onForegroundMessage: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void,
): Promise<(() => void) | null> {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  return onMessage(messaging, (payload) => {
    onForegroundMessage({
      title: payload.notification?.title,
      body: payload.notification?.body,
      data: (payload.data as Record<string, string> | undefined) ?? undefined,
    });
  });
}
