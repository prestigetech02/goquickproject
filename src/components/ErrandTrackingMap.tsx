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
  const { data, isPending, error, refetch } = useErrandTrackingQuery(errandId, !!token);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const runnerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const fittedRef = useRef(false);

  const effectiveRunner = useMemo<LiveRunnerPosition | null>(() => {
    if (runnerPos) return runnerPos;
    if (data?.runner && isFiniteCoord(data.runner.latitude, data.runner.longitude)) {
      return {
        lat: data.runner.latitude!,
        lng: data.runner.longitude!,
        updatedAt: data.runner.updated_at,
      };
    }
    return null;
  }, [runnerPos, data]);

  const routeCoords = useMemo(() => {
    if (!data?.polyline) return [] as [number, number][];
    return decodePolyline(data.polyline);
  }, [data?.polyline]);

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
      fittedRef.current = false;
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

      // Refit when tracking snapshot / route changes — not on every GPS ping.
      fitMap(map, data, routeCoords, effectiveRunner);
      fittedRef.current = true;
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
    // intentionally omit effectiveRunner so live GPS does not re-fit the camera
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit uses runner snapshot at load time
  }, [data, routeCoords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !effectiveRunner) return;

    const lngLat: [number, number] = [effectiveRunner.lng, effectiveRunner.lat];
    if (!runnerMarkerRef.current) {
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

      runnerMarkerRef.current = new mapboxgl.Marker({
        element: el,
        // Pin tip sits on the coordinates.
        anchor: "bottom",
        offset: [0, 2],
      })
        .setLngLat(lngLat)
        .addTo(map);
    } else {
      runnerMarkerRef.current.setLngLat(lngLat);
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
