/** Curated Explore places — types and helpers. Data comes from /explore APIs. */

export type ExploreCategory = {
  slug: string;
  name: string;
  description: string;
  icon?: string;
};

export type ExplorePlace = {
  id: number;
  name: string;
  category: string;
  description: string;
  address_line: string;
  area: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  images: string[];
  is_active: boolean;
};

export type ExploreOrigin = { latitude: number; longitude: number };

export function exploreCategoryLabel(slug: string, categories: ExploreCategory[] = []): string {
  return categories.find((c) => c.slug === slug)?.name ?? slug;
}

export function exploreFullAddress(place: ExplorePlace): string {
  const locality = [place.area, place.city, place.state].filter(Boolean).join(", ");
  return locality ? `${place.address_line}, ${locality}` : place.address_line;
}

export function exploreCover(place: ExplorePlace): string | null {
  return place.images[0] ?? null;
}

/** Rough distance in km (Haversine). */
export function distanceKm(
  from: ExploreOrigin,
  to: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round(km * 1000))} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/** Map Explore place category → create-errand type slug. */
export function errandTypeForPlaceCategory(slug: string): string {
  switch (slug) {
    case "supermarket":
    case "market":
    case "pharmacy":
    case "restaurant":
      return "shopping";
    case "bank":
    case "hospital":
      return "queue";
    default:
      return "custom";
  }
}

export type ExplorePrefillState = {
  placeId: number;
  placeName: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  description: string;
  errandType: string;
};
