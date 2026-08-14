import { http } from "./http";
import type { ApiResponse } from "../types/api";

export type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  feature_type?: string | null;
  poi_categories?: string[];
  maki?: string | null;
  session_token?: string;
};

export type PlaceDetails = {
  place_id: string;
  name?: string | null;
  formatted_address?: string | null;
  latitude: number;
  longitude: number;
};

export type LocationPoint = {
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  /** True while place details (coords) are still loading after a tap. */
  resolving?: boolean;
  /** True when the user entered a free-text label + map pin. */
  isCustom?: boolean;
};

/** Stable UUIDv4 for one Mapbox Search Box suggest→retrieve billing session. */
export function createPlacesSessionToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function fetchPlaceAutocomplete(
  input: string,
  options?: {
    sessionToken?: string;
    latitude?: number;
    longitude?: number;
  },
) {
  const { data } = await http.get<
    ApiResponse<{ predictions: PlacePrediction[]; session_token?: string }>
  >("/places/autocomplete", {
    params: {
      input,
      components: "country:ng",
      language: "en",
      session_token: options?.sessionToken,
      latitude: options?.latitude,
      longitude: options?.longitude,
    },
  });
  if (!data.success) {
    return {
      success: false as const,
      data: null,
      sessionToken: options?.sessionToken ?? null,
      error: data.error ?? { message: "Failed to search places" },
    };
  }
  return {
    success: true as const,
    data: data.data?.predictions ?? [],
    sessionToken: data.data?.session_token ?? options?.sessionToken ?? null,
  };
}

export async function fetchPlaceDetails(placeId: string, sessionToken?: string | null) {
  const { data } = await http.get<
    ApiResponse<{
      result?: {
        place_id?: string;
        name?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      };
      session_token?: string;
    }>
  >("/places/details", {
    params: {
      place_id: placeId,
      session_token: sessionToken || undefined,
    },
  });

  if (!data.success || !data.data?.result) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to load place details" },
    };
  }

  const result = data.data.result;
  const lat = Number(result.geometry?.location?.lat);
  const lng = Number(result.geometry?.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      success: false as const,
      data: null,
      error: { message: "Place is missing coordinates" },
    };
  }

  const details: PlaceDetails = {
    place_id: result.place_id ?? placeId,
    name: result.name ?? null,
    formatted_address: result.formatted_address ?? result.name ?? null,
    latitude: lat,
    longitude: lng,
  };

  return { success: true as const, data: details };
}

export async function checkLocationServiceability(latitude: number, longitude: number) {
  const { data } = await http.post<
    ApiResponse<{
      serviceable: boolean;
      zone_id?: number | null;
      zone_name?: string | null;
    }>
  >("/locations/serviceability", { latitude, longitude });

  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to check service area" },
    };
  }

  return {
    success: true as const,
    data: {
      serviceable: Boolean(data.data.serviceable),
      zone_id: data.data.zone_id ?? null,
      zone_name: data.data.zone_name?.trim() || "this area",
    },
  };
}

export function featureTypeLabel(featureType?: string | null, poiCategories?: string[]): string {
  if (poiCategories && poiCategories.length > 0) {
    return poiCategories[0].replace(/_/g, " ");
  }
  switch ((featureType || "").toLowerCase()) {
    case "poi":
      return "Place";
    case "brand":
      return "Brand";
    case "address":
      return "Address";
    case "street":
      return "Street";
    case "neighborhood":
      return "Neighborhood";
    case "locality":
    case "place":
    case "city":
      return "Area";
    case "district":
      return "District";
    case "postcode":
      return "Postcode";
    default:
      return featureType ? featureType.replace(/_/g, " ") : "Result";
  }
}
