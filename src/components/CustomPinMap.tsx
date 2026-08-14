import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { config } from "../lib/config";

const LAGOS: [number, number] = [3.3792, 6.5244];

type Props = {
  latitude: number;
  longitude: number;
  onMove: (lat: number, lng: number) => void;
  className?: string;
};

export function CustomPinMap({ latitude, longitude, onMove, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const token = config.mapboxAccessToken;

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const startLng = Number.isFinite(longitude) ? longitude : LAGOS[0];
    const startLat = Number.isFinite(latitude) ? latitude : LAGOS[1];

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [startLng, startLat],
      zoom: 14,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    const marker = new mapboxgl.Marker({ color: "#1a7a0a", draggable: true })
      .setLngLat([startLng, startLat])
      .addTo(map);

    marker.on("dragend", () => {
      const { lng, lat } = marker.getLngLat();
      onMoveRef.current(lat, lng);
    });

    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      onMoveRef.current(e.lngLat.lat, e.lngLat.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Mount once; pin sync handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const current = markerRef.current.getLngLat();
    if (Math.abs(current.lat - latitude) < 1e-7 && Math.abs(current.lng - longitude) < 1e-7) {
      return;
    }
    markerRef.current.setLngLat([longitude, latitude]);
    mapRef.current.easeTo({ center: [longitude, latitude], duration: 300 });
  }, [latitude, longitude]);

  if (!token) {
    return (
      <p className="muted location-picker-hint">
        Map pin needs <code>VITE_MAPBOX_ACCESS_TOKEN</code>. You can still search places above.
      </p>
    );
  }

  return <div ref={containerRef} className={className ?? "custom-pin-map"} />;
}
