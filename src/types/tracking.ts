export type ErrandTrackingPoint = {
  latitude: number | null;
  longitude: number | null;
  address?: string | null;
};

export type ErrandTrackingRunner = {
  id: number;
  latitude: number | null;
  longitude: number | null;
  updated_at: string | null;
};

export type ErrandTracking = {
  errand_id: number;
  status: string;
  leg: string | null;
  polyline: string | null;
  distance_m: number | null;
  duration_s: number | null;
  distance_km: number | null;
  eta_minutes: number | null;
  route_provider: string | null;
  route_computed_at: string | null;
  runner: ErrandTrackingRunner | null;
  pickup: ErrandTrackingPoint;
  dropoff: ErrandTrackingPoint;
};

/** Statuses where live map tracking is useful for the requester. */
export function isTrackableErrandStatus(status: string): boolean {
  const s = status.toLowerCase();
  return [
    "accepted",
    "on_my_way",
    "arrived",
    "in_progress",
    "delayed",
    "waiting_for_buyer",
  ].includes(s);
}
