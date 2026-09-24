import { http } from "./http";
import type { ApiResponse, SavedPlace } from "../types/api";
import type { LocationPoint } from "./placesApi";

export type SavedPlacePayload = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  place_id?: string | null;
};

export async function fetchSavedPlaces() {
  const { data } = await http.get<ApiResponse<{ places: SavedPlace[] }>>("/user/saved-places");
  return data;
}

export async function createSavedPlace(payload: SavedPlacePayload) {
  const { data } = await http.post<ApiResponse<{ place: SavedPlace; places: SavedPlace[] }>>(
    "/user/saved-places",
    payload,
  );
  return data;
}

export async function updateSavedPlace(id: string, payload: Partial<SavedPlacePayload>) {
  const { data } = await http.put<ApiResponse<{ place: SavedPlace; places: SavedPlace[] }>>(
    `/user/saved-places/${encodeURIComponent(id)}`,
    payload,
  );
  return data;
}

export async function deleteSavedPlace(id: string) {
  const { data } = await http.delete<ApiResponse<{ places: SavedPlace[] }>>(
    `/user/saved-places/${encodeURIComponent(id)}`,
  );
  return data;
}

export function locationPointFromSavedPlace(place: SavedPlace): LocationPoint {
  return {
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    placeId: place.place_id ?? undefined,
    resolving: false,
    isCustom: false,
  };
}

export function matchingSavedPlaceId(
  point: { address?: string; latitude?: number; longitude?: number } | null | undefined,
  places: SavedPlace[],
): string | undefined {
  if (!point) return undefined;
  return places.find((place) => {
    if (point.address && place.address === point.address) return true;
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return false;
    return (
      Math.abs(place.latitude - (point.latitude ?? 0)) < 0.00015 &&
      Math.abs(place.longitude - (point.longitude ?? 0)) < 0.00015
    );
  })?.id;
}

export function savedPlaceChipLabel(place: SavedPlace): string {
  const slug = place.label.trim().toLowerCase();
  if (slug === "home") return "🏠 Home";
  if (slug === "work") return "💼 Work";
  if (slug === "office") return "🏢 Office";
  if (slug === "market") return "🛒 Market";
  return `📍 ${place.label}`;
}
