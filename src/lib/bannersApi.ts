import { http } from "./http";

/** Admin-managed promo banner from `GET /banners` (same "Requester" audience as the mobile app). */
export type AppBanner = {
  id: number;
  title: string;
  display: "inline" | "popup";
  popup_frequency: "once" | "daily" | "every_open" | null;
  image_url: string;
  link_type: "none" | "url" | "screen";
  link_value: string | null;
  updated_at: string | null;
};

const POPUP_SEEN_KEY = "requester_banner_popups_seen";
const POPUP_SESSION_KEY = "requester_banner_popup_this_session";
const DAY_MS = 24 * 60 * 60 * 1000;

type PopupSeen = Record<string, { v: string | null; at: number }>;

export async function fetchBanners(): Promise<AppBanner[]> {
  const res = await http.get<{ success: boolean; data?: { banners?: AppBanner[] } }>("/banners", {
    params: { audience: "requester" },
  });
  return res.data.success ? (res.data.data?.banners ?? []).filter((b) => b.image_url) : [];
}

export function isTappable(banner: AppBanner): boolean {
  return banner.link_type !== "none" && Boolean(banner.link_value?.trim());
}

function readPopupSeen(): PopupSeen {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(POPUP_SEEN_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as PopupSeen) : {};
  } catch {
    return {};
  }
}

/**
 * The first popup due now, or null. At most one popup per browser session;
 * "once" comes back after an admin edits it, "daily" after 24 hours,
 * "every_open" on every new session.
 */
export function pickDuePopup(popups: AppBanner[]): AppBanner | null {
  try {
    if (sessionStorage.getItem(POPUP_SESSION_KEY)) return null;
  } catch {
    /* fall through to the persisted record */
  }
  const seen = readPopupSeen();
  return (
    popups.find((popup) => {
      const record = seen[String(popup.id)];
      if (popup.popup_frequency === "every_open") return true;
      if (popup.popup_frequency === "daily") return !record || Date.now() - record.at >= DAY_MS;
      return !record || record.v !== popup.updated_at;
    }) ?? null
  );
}

export function markPopupShown(popup: AppBanner, liveIds: number[]) {
  try {
    sessionStorage.setItem(POPUP_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
  try {
    const seen = Object.fromEntries(
      Object.entries(readPopupSeen()).filter(([id]) => liveIds.includes(Number(id))),
    );
    seen[String(popup.id)] = { v: popup.updated_at, at: Date.now() };
    localStorage.setItem(POPUP_SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* private mode: the popup may show again next session */
  }
}
