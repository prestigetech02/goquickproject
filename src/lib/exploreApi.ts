import { http } from "./http";
import type { ExploreCategory, ExploreOrigin, ExplorePlace } from "./explorePlaces";

type ApiSuccess<T> = { success: boolean; data?: T; error?: { message?: string } };

export type ExplorePlaceRow = ExplorePlace & { distance_km: number | null };

export async function fetchExploreCategories(): Promise<ExploreCategory[]> {
  const res = await http.get<ApiSuccess<{ categories: ExploreCategory[] }>>("/explore/categories");
  if (!res.data.success) {
    throw new Error(res.data.error?.message ?? "Failed to load categories.");
  }
  return res.data.data?.categories ?? [];
}

export async function fetchExplorePlaces(options?: {
  category?: string | null;
  area?: string | null;
  query?: string | null;
  origin?: ExploreOrigin | null;
  limit?: number;
}): Promise<{ places: ExplorePlaceRow[]; areas: string[] }> {
  const params: Record<string, string | number> = {};
  if (options?.category) params.category = options.category;
  if (options?.area) params.area = options.area;
  if (options?.query) params.q = options.query;
  if (options?.origin) {
    params.latitude = options.origin.latitude;
    params.longitude = options.origin.longitude;
  }
  if (options?.limit) params.limit = options.limit;

  const res = await http.get<ApiSuccess<{ places: ExplorePlaceRow[]; areas: string[] }>>("/explore/places", {
    params,
  });
  if (!res.data.success) {
    throw new Error(res.data.error?.message ?? "Failed to load places.");
  }
  return {
    places: res.data.data?.places ?? [],
    areas: res.data.data?.areas ?? [],
  };
}

export async function fetchExplorePlace(
  id: number,
  origin?: ExploreOrigin | null,
): Promise<ExplorePlaceRow> {
  const params: Record<string, number> = {};
  if (origin) {
    params.latitude = origin.latitude;
    params.longitude = origin.longitude;
  }
  const res = await http.get<ApiSuccess<ExplorePlaceRow>>(`/explore/places/${id}`, { params });
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.error?.message ?? "Place not found.");
  }
  return res.data.data;
}
