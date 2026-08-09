import { http } from "./http";
import type { ApiResponse } from "../types/api";

export type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
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
};

export async function fetchPlaceAutocomplete(input: string) {
  const { data } = await http.get<ApiResponse<{ predictions: PlacePrediction[] }>>(
    "/places/autocomplete",
    {
      params: {
        input,
        components: "country:ng",
        language: "en",
      },
    },
  );
  if (!data.success) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to search places" },
    };
  }
  return {
    success: true as const,
    data: data.data?.predictions ?? [],
  };
}

export async function fetchPlaceDetails(placeId: string) {
  const { data } = await http.get<
    ApiResponse<{
      result?: {
        place_id?: string;
        name?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      };
    }>
  >("/places/details", {
    params: { place_id: placeId },
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
