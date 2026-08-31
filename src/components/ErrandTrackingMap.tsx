import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { config } from "../lib/config";
import { decodePolyline } from "../lib/polyline";
import { useErrandTrackingQuery } from "../lib/queries";
import type { ErrandTracking } from "../types/tracking";

const ROUTE_SOURCE = "errand-route";
const ROUTE_LAYER = "errand-route-line";
const DEFAULT_CENTER: [number, number] = [3.3792, 6.5244]; // Lagos

export type LiveRunnerPosition = {
  lat: number;
  lng: number;
  updatedAt: string | null;
};

type Props = {
  errandId: number;
  /** From Echo runner.location.updated (marker only). */
  runnerPos: LiveRunnerPosition | null;
  live?: boolean;
};

function isFiniteCoord(lat: number | null | undefined, lng: number | null | undefined) {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

function routeGeoJson(coords: [number, number][]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: coords,
    },
  };
}

function metersBetween(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function newerPos(a: LiveRunnerPosition | null, b: LiveRunnerPosition | null): LiveRunnerPosition | null {
  if (!a) return b;
  if (!b) return a;
  const ta = Date.parse(a.updatedAt ?? "") || 0;
  const tb = Date.parse(b.updatedAt ?? "") || 0;
  return tb > ta ? b : a;
}

function staleLabel(updatedAt: string | null | undefined): string | null {
  if (!updatedAt) return "Runner location not available yet";
  const ts = Date.parse(updatedAt);
  if (!Number.isFinite(ts)) return null;
  const ageMin = (Date.now() - ts) / 60_000;
  if (ageMin > 5) return "Runner location may be outdated";
  return null;
}

export function ErrandTrackingMap({ errandId, runnerPos, live = false }: Props) {
  const token = config.mapboxAccessToken;
  const { data, isPending, error, refetch } = useErrandTrackingQuery(errandId, !!token, {
    refetchInterval: live ? 4_000 : 8_000,
  });
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const runnerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const fittedFingerprintRef = useRef<string | null>(null);
  const displayedLngLatRef = useRef<[number, number] | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const animGenRef = useRef(0);

  const queryRunner = useMemo<LiveRunnerPosition | null>(() => {
    if (data?.runner && isFiniteCoord(data.runner.latitude, data.runner.longitude)) {
      return {
        lat: data.runner.latitude!,
        lng: data.runner.longitude!,
        updatedAt: data.runner.updated_at,
      };
    }
    return null;
  }, [data]);

  const effectiveRunner = useMemo(
    () => newerPos(runnerPos, queryRunner),
    [runnerPos, queryRunner],
  );

  const routeCoords = useMemo(() => {
    if (!data?.polyline) return [] as [number, number][];
    return decodePolyline(data.polyline);
  }, [data?.polyline]);

  const routeFingerprint = `${data?.polyline ?? ""}:${data?.pickup.latitude}:${data?.pickup.longitude}:${data?.dropoff.latitude}:${data?.dropoff.longitude}`;

  useEffect(() => {
    if (!token || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: DEFAULT_CENTER,
      zoom: 12,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    return () => {
      runnerMarkerRef.current?.remove();
      pickupMarkerRef.current?.remove();
      dropoffMarkerRef.current?.remove();
      runnerMarkerRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      fittedFingerprintRef.current = null;
      displayedLngLatRef.current = null;
      animGenRef.current += 1;
      if (animFrameRef.current != null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [token]);

  // Draw polyline + static markers for the current tracking snapshot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;

    const apply = () => {
      const existing = map.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
      if (routeCoords.length >= 2) {
        const geo = routeGeoJson(routeCoords);
        if (existing) {
          existing.setData(geo);
        } else {
          map.addSource(ROUTE_SOURCE, { type: "geojson", data: geo });
          map.addLayer({
            id: ROUTE_LAYER,
            type: "line",
            source: ROUTE_SOURCE,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#0B6E4F",
              "line-width": 4,
              "line-opacity": 0.9,
            },
          });
        }
      } else if (existing) {
        if (map.getLayer(ROUTE_LAYER)) map.removeLayer(ROUTE_LAYER);
        map.removeSource(ROUTE_SOURCE);
      }

      if (isFiniteCoord(data.pickup.latitude, data.pickup.longitude)) {
        const lngLat: [number, number] = [data.pickup.longitude!, data.pickup.latitude!];
        if (!pickupMarkerRef.current) {
          pickupMarkerRef.current = new mapboxgl.Marker({ color: "#2563eb" })
            .setLngLat(lngLat)
            .setPopup(new mapboxgl.Popup({ offset: 16 }).setText("Pickup"))
            .addTo(map);
        } else {
          pickupMarkerRef.current.setLngLat(lngLat);
        }
      } else if (pickupMarkerRef.current) {
        pickupMarkerRef.current.remove();
        pickupMarkerRef.current = null;
      }

      if (isFiniteCoord(data.dropoff.latitude, data.dropoff.longitude)) {
        const lngLat: [number, number] = [data.dropoff.longitude!, data.dropoff.latitude!];
        if (!dropoffMarkerRef.current) {
          dropoffMarkerRef.current = new mapboxgl.Marker({ color: "#b45309" })
            .setLngLat(lngLat)
            .setPopup(new mapboxgl.Popup({ offset: 16 }).setText("Drop-off"))
            .addTo(map);
        } else {
          dropoffMarkerRef.current.setLngLat(lngLat);
        }
      } else if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.remove();
        dropoffMarkerRef.current = null;
      }

      if (fittedFingerprintRef.current !== routeFingerprint) {
        fitMap(map, data, routeCoords, effectiveRunner);
        fittedFingerprintRef.current = routeFingerprint;
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runner GPS must not re-fit the camera
  }, [data, routeCoords, routeFingerprint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !effectiveRunner) return;

    const target: [number, number] = [effectiveRunner.lng, effectiveRunner.lat];

    const ensureMarker = (lngLat: [number, number]) => {
      if (runnerMarkerRef.current) return runnerMarkerRef.current;
      const el = document.createElement("div");
      el.className = "errand-tracking-runner-pin";
      el.title = "Runner";
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", "Runner location");

      const img = document.createElement("img");
      img.src = "/goquick-runner-pin.png";
      img.alt = "";
      img.draggable = false;
      el.appendChild(img);

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "bottom",
        offset: [0, 2],
      })
        .setLngLat(lngLat)
        .addTo(map);
      runnerMarkerRef.current = marker;
      displayedLngLatRef.current = lngLat;
      return marker;
    };

    const from = displayedLngLatRef.current;
    const marker = ensureMarker(from ?? target);

    animGenRef.current += 1;
    if (animFrameRef.current != null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (!from || metersBetween(from, target) < 2) {
      marker.setLngLat(target);
      displayedLngLatRef.current = target;
      return;
    }

    const gen = animGenRef.current;
    const start = performance.now();
    const duration = Math.min(4_500, Math.max(800, metersBetween(from, target) * 80));

    const tick = (now: number) => {
      if (gen !== animGenRef.current) return;
      const t = Math.min(1, (now - start) / duration);
      const e = easeInOutCubic(t);
      const next: [number, number] = [
        from[0] + (target[0] - from[0]) * e,
        from[1] + (target[1] - from[1]) * e,
      ];
      marker.setLngLat(next);
      displayedLngLatRef.current = next;
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);

    const point = map.project(target);
    const canvas = map.getCanvas();
    const pad = 72;
    if (
      point.x < pad ||
      point.y < pad ||
      point.x > canvas.clientWidth - pad ||
      point.y > canvas.clientHeight - pad
    ) {
      map.easeTo({ center: target, duration: 900, essential: true });
    }
  }, [effectiveRunner]);

  if (!token) {
    return (
      <section className="card stack">
        <h2 className="profile-card-title">Live tracking</h2>
        <p className="muted">
          Mapbox is not configured. Set <code>VITE_MAPBOX_ACCESS_TOKEN</code> (public{" "}
          <code>pk.</code> token) in the web env and restart Vite.
        </p>
      </section>
    );
  }

  const stale = staleLabel(effectiveRunner?.updatedAt ?? data?.runner?.updated_at);
  const eta =
    data?.eta_minutes != null
      ? `~${data.eta_minutes} min`
      : data?.duration_s != null
        ? `~${Math.max(1, Math.ceil(data.duration_s / 60))} min`
        : null;

  return (
    <section className="card stack errand-tracking">
      <div className="errand-tracking-header">
        <h2 className="profile-card-title">Live tracking</h2>
        <div className="errand-tracking-meta muted">
          {live ? <span className="errand-tracking-live">Live</span> : <span>Waiting for live link…</span>}
          {eta ? <span>ETA {eta}</span> : null}
          {data?.distance_km != null ? <span>{data.distance_km.toFixed(1)} km</span> : null}
        </div>
      </div>

      {isPending && !data ? <p className="muted">Loading route…</p> : null}
      {error ? (
        <p className="error">
          Could not load tracking.{" "}
          <button type="button" className="linkish" onClick={() => void refetch()}>
            Retry
          </button>
        </p>
      ) : null}

      {stale ? <p className="muted errand-tracking-stale">{stale}</p> : null}

      <div ref={mapContainerRef} className="errand-tracking-map" role="presentation" />
    </section>
  );
}

function fitMap(
  map: mapboxgl.Map,
  data: ErrandTracking,
  routeCoords: [number, number][],
  runnerPos: LiveRunnerPosition | null,
) {
  const bounds = new mapboxgl.LngLatBounds();
  let has = false;

  for (const c of routeCoords) {
    bounds.extend(c);
    has = true;
  }
  if (isFiniteCoord(data.pickup.latitude, data.pickup.longitude)) {
    bounds.extend([data.pickup.longitude!, data.pickup.latitude!]);
    has = true;
  }
  if (isFiniteCoord(data.dropoff.latitude, data.dropoff.longitude)) {
    bounds.extend([data.dropoff.longitude!, data.dropoff.latitude!]);
    has = true;
  }
  if (runnerPos) {
    bounds.extend([runnerPos.lng, runnerPos.lat]);
    has = true;
  }

  if (!has) {
    map.setCenter(DEFAULT_CENTER);
    map.setZoom(11);
    return;
  }

  map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
}
