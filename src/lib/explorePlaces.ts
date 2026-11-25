/** Curated Explore places — mock data until the Places API is wired. */

export type ExploreCategory = {
  slug: string;
  name: string;
  description: string;
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

export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  { slug: "supermarket", name: "Supermarket", description: "Grocery and household shopping" },
  { slug: "pharmacy", name: "Pharmacy", description: "Medicine and personal care" },
  { slug: "bank", name: "Bank", description: "Cash deposit, withdrawal, or account help" },
  { slug: "hospital", name: "Hospital", description: "Clinic or hospital pickup" },
  { slug: "filling_station", name: "Filling station", description: "Fuel or LPG" },
  { slug: "market", name: "Market", description: "Open market or plaza" },
  { slug: "hotel", name: "Hotel", description: "Hotel or guest house" },
  { slug: "restaurant", name: "Restaurant", description: "Restaurant or eatery" },
  { slug: "lounge", name: "Lounge", description: "Bar, café, or lounge" },
  { slug: "other", name: "Other", description: "Anything else runners can visit" },
];

export const EXPLORE_PLACES: ExplorePlace[] = [
  {
    id: 1,
    name: "Shoprite Ikeja City Mall",
    category: "supermarket",
    description:
      "Full-service supermarket inside Ikeja City Mall. Good for grocery lists and household restocks.",
    address_line: "Ikeja City Mall, Obafemi Awolowo Way",
    area: "Ikeja",
    city: "Ikeja",
    state: "Lagos",
    latitude: 6.6194,
    longitude: 3.3578,
    phone: null,
    images: [
      "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1583258292688-2f7b4b6bfa1f?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&h=800&fit=crop&sat=-20",
      "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&h=800&fit=crop&sat=-30",
    ],
    is_active: true,
  },
  {
    id: 2,
    name: "HealthPlus Lekki",
    category: "pharmacy",
    description: "Pharmacy on Admiralty Way for prescriptions, OTC meds, and personal care.",
    address_line: "Admiralty Way",
    area: "Lekki Phase 1",
    city: "Eti-Osa",
    state: "Lagos",
    latitude: 6.4478,
    longitude: 3.4722,
    phone: "08090000001",
    images: [
      "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=800&h=800&fit=crop",
    ],
    is_active: true,
  },
  {
    id: 3,
    name: "GTBank Victoria Island",
    category: "bank",
    description: "GTBank branch on Oyin Jolayemi for deposits, withdrawals, and account help.",
    address_line: "Plot 1669, Oyin Jolayemi Street",
    area: "Victoria Island",
    city: "Lagos Island",
    state: "Lagos",
    latitude: 6.4281,
    longitude: 3.4219,
    phone: null,
    images: ["https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=600&fit=crop"],
    is_active: true,
  },
  {
    id: 4,
    name: "ABC Supermarket Yaba",
    category: "supermarket",
    description: "Neighbourhood supermarket on Herbert Macaulay Way for quick grocery runs.",
    address_line: "Herbert Macaulay Way",
    area: "Yaba",
    city: "Yaba",
    state: "Lagos",
    latitude: 6.5095,
    longitude: 3.3715,
    phone: null,
    images: ["https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop"],
    is_active: true,
  },
  {
    id: 5,
    name: "MedPlus Surulere",
    category: "pharmacy",
    description: "Pharmacy for prescriptions and everyday health items around Surulere.",
    address_line: "Adeniran Ogunsanya Street",
    area: "Surulere",
    city: "Surulere",
    state: "Lagos",
    latitude: 6.4969,
    longitude: 3.3568,
    phone: null,
    images: ["https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800&h=600&fit=crop"],
    is_active: true,
  },
  {
    id: 6,
    name: "Balogun Market",
    category: "market",
    description: "Busy market for fabrics, accessories, and bulk household goods.",
    address_line: "Balogun Street",
    area: "Lagos Island",
    city: "Lagos Island",
    state: "Lagos",
    latitude: 6.455,
    longitude: 3.389,
    phone: null,
    images: ["https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&h=600&fit=crop"],
    is_active: true,
  },
];

export type ExploreOrigin = { latitude: number; longitude: number };

export function exploreCategoryLabel(slug: string): string {
  return EXPLORE_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
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

export function getExplorePlace(id: number): ExplorePlace | null {
  return EXPLORE_PLACES.find((place) => place.id === id && place.is_active) ?? null;
}

export function listExplorePlaces(options?: {
  category?: string | null;
  area?: string | null;
  query?: string | null;
  origin?: ExploreOrigin | null;
}): Array<ExplorePlace & { distance_km: number | null }> {
  const category = options?.category?.trim() || null;
  const area = options?.area?.trim() || null;
  const query = options?.query?.trim().toLowerCase() || null;
  const origin = options?.origin ?? null;

  const rows = EXPLORE_PLACES.filter((place) => {
    if (!place.is_active) return false;
    if (category && place.category !== category) return false;
    if (area && place.area !== area) return false;
    if (query) {
      const hay = `${place.name} ${place.area} ${place.city} ${place.address_line} ${place.description}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  }).map((place) => ({
    ...place,
    distance_km: origin ? distanceKm(origin, place) : null,
  }));

  rows.sort((a, b) => {
    if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km;
    return a.name.localeCompare(b.name);
  });

  return rows;
}

export function exploreAreas(): string[] {
  return [...new Set(EXPLORE_PLACES.filter((p) => p.is_active).map((p) => p.area))].sort((a, b) =>
    a.localeCompare(b),
  );
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
