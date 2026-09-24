import { config } from "./config";
import type { LocationPoint } from "./placesApi";

export type DefaultAddressKind = "current" | "place" | "custom";

export type DefaultAddress = {
  kind: DefaultAddressKind;
  /** Saved-place id when kind is `place`. */
  placeId?: string;
  /** Short chip label e.g. Home / Work. */
  label?: string;
  address: string;
  latitude: number;
  longitude: number;
};

const STORAGE_KEY = "requester_default_address";

export function loadDefaultAddress(): DefaultAddress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DefaultAddress>;
    if (
      typeof parsed.address !== "string" ||
      !Number.isFinite(parsed.latitude) ||
      !Number.isFinite(parsed.longitude)
    ) {
      return null;
    }
    return {
      kind: parsed.kind === "place" || parsed.kind === "current" ? parsed.kind : "custom",
      placeId: typeof parsed.placeId === "string" ? parsed.placeId : undefined,
      label: typeof parsed.label === "string" ? parsed.label : undefined,
      address: parsed.address.trim(),
      latitude: Number(parsed.latitude),
      longitude: Number(parsed.longitude),
    };
  } catch {
    return null;
  }
}

export function saveDefaultAddress(value: DefaultAddress | null): void {
  try {
    if (!value) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function defaultAddressDisplayLabel(addr: DefaultAddress | null | undefined): string {
  if (!addr) return "Set your address";
  const area =
    addr.address
      .split(",")
      .map((p) => p.trim())
      .find(Boolean) || addr.address.trim();
  const kindLabel =
    addr.kind === "current"
      ? "Current"
      : addr.label?.trim()
        ? addr.label.trim()
        : addr.kind === "place"
          ? "Saved"
          : "";
  if (kindLabel && area) return `${kindLabel} · ${area}`;
  if (area) return area;
  if (kindLabel) return kindLabel;
  return "Set your address";
}

export function locationPointFromDefault(addr: DefaultAddress): LocationPoint {
  return {
    address: addr.address,
    latitude: addr.latitude,
    longitude: addr.longitude,
    placeId: addr.placeId,
    resolving: false,
    isCustom: addr.kind === "custom",
  };
}

export async function reverseGeocodeLabel(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const token = config.mapboxAccessToken?.trim();
  if (!token) return null;
  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
    );
    url.searchParams.set("access_token", token);
    url.searchParams.set("types", "address,poi,neighborhood,locality,place");
    url.searchParams.set("limit", "1");
    url.searchParams.set("language", "en");
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ place_name?: string; text?: string }>;
    };
    const feature = data.features?.[0];
    const name = feature?.place_name?.trim() || feature?.text?.trim();
    return name || null;
  } catch {
    return null;
  }
}

export function getBrowserPosition(options?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 60_000,
      ...options,
    });
  });
}

export async function detectCurrentDefaultAddress(): Promise<DefaultAddress> {
  const pos = await getBrowserPosition();
  const latitude = pos.coords.latitude;
  const longitude = pos.coords.longitude;
  const address =
    (await reverseGeocodeLabel(latitude, longitude)) || "Current location";
  return {
    kind: "current",
    address,
    latitude,
    longitude,
  };
}
