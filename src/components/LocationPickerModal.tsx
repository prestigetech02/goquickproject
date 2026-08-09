import { useEffect, useId, useRef, useState } from "react";
import { getApiErrorMessage } from "../lib/http";
import {
  checkLocationServiceability,
  fetchPlaceAutocomplete,
  fetchPlaceDetails,
  type LocationPoint,
  type PlacePrediction,
} from "../lib/placesApi";
import { ServiceZoneUnavailableModal } from "./ServiceZoneUnavailableModal";

type Props = {
  title: string;
  onClose: () => void;
  onSelect: (point: LocationPoint) => void;
};

export function LocationPickerModal({ title, onClose, onSelect }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !resolvingId) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, resolvingId]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setPredictions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetchPlaceAutocomplete(q);
          if (cancelled) return;
          if (!res.success) {
            setError(res.error?.message ?? "Search failed");
            setPredictions([]);
          } else {
            setError(null);
            setPredictions(res.data);
          }
        } catch (err) {
          if (!cancelled) {
            setError(getApiErrorMessage(err, "Search failed"));
            setPredictions([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  async function handlePick(prediction: PlacePrediction) {
    setResolvingId(prediction.place_id);
    setError(null);
    try {
      const detailsRes = await fetchPlaceDetails(prediction.place_id);
      if (!detailsRes.success || !detailsRes.data) {
        setError(detailsRes.error?.message ?? "Could not load that place");
        return;
      }
      const place = detailsRes.data;
      const zoneRes = await checkLocationServiceability(place.latitude, place.longitude);
      if (!zoneRes.success || !zoneRes.data) {
        setError(zoneRes.error?.message ?? "Could not check service area");
        return;
      }
      if (!zoneRes.data.serviceable) {
        setZoneName(zoneRes.data.zone_name);
        return;
      }

      onSelect({
        address: place.formatted_address || place.name || prediction.description,
        latitude: place.latitude,
        longitude: place.longitude,
        placeId: place.place_id,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not use that location"));
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <>
      <div
        className="modal-backdrop"
        role="presentation"
        onClick={() => !resolvingId && onClose()}
      >
        <div
          className="modal-panel location-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="notification-modal-header">
            <h2 id={titleId} className="notification-modal-title" style={{ margin: 0 }}>
              {title}
            </h2>
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={onClose}
              disabled={Boolean(resolvingId)}
            >
              ×
            </button>
          </div>

          <label className="location-picker-search">
            <span className="sr-only">Search address</span>
            <input
              ref={inputRef}
              type="search"
              placeholder="Search address in Nigeria…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={Boolean(resolvingId)}
              autoComplete="off"
            />
          </label>

          {error ? <p className="error">{error}</p> : null}

          <div className="location-picker-results" aria-live="polite">
            {loading ? <p className="muted location-picker-hint">Searching…</p> : null}
            {!loading && query.trim().length >= 2 && predictions.length === 0 ? (
              <p className="muted location-picker-hint">No places found.</p>
            ) : null}
            {!loading && query.trim().length < 2 ? (
              <p className="muted location-picker-hint">Type at least 2 characters to search.</p>
            ) : null}
            <ul className="location-picker-list">
              {predictions.map((p) => {
                const main = p.structured_formatting?.main_text || p.description;
                const secondary = p.structured_formatting?.secondary_text;
                const busy = resolvingId === p.place_id;
                return (
                  <li key={p.place_id}>
                    <button
                      type="button"
                      className="location-picker-item"
                      disabled={Boolean(resolvingId)}
                      onClick={() => void handlePick(p)}
                    >
                      <span className="location-picker-main">{busy ? "Checking…" : main}</span>
                      {secondary ? (
                        <span className="location-picker-secondary muted">{secondary}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {zoneName ? (
        <ServiceZoneUnavailableModal zoneName={zoneName} onClose={() => setZoneName(null)} />
      ) : null}
    </>
  );
}
