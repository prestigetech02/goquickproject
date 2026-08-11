import { useEffect, useId, useRef, useState } from "react";
import { getApiErrorMessage } from "../lib/http";
import {
  createPlacesSessionToken,
  featureTypeLabel,
  fetchPlaceAutocomplete,
  fetchPlaceDetails,
  type LocationPoint,
  type PlacePrediction,
} from "../lib/placesApi";

type Props = {
  title: string;
  onClose: () => void;
  onSelect: (point: LocationPoint) => void;
  /** Called if details fail after an optimistic select (modal already closed). */
  onSelectFailed?: (message: string) => void;
};

type UserCoords = { latitude: number; longitude: number };

function predictionAddress(prediction: PlacePrediction): string {
  const main = prediction.structured_formatting?.main_text?.trim();
  const secondary = prediction.structured_formatting?.secondary_text?.trim();
  if (main && secondary) return `${main}, ${secondary}`;
  if (main) return main;
  return prediction.description;
}

export function LocationPickerModal({ title, onClose, onSelect, onSelectFailed }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef(createPlacesSessionToken());
  const pickingRef = useRef(false);
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pickingRef.current) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        /* server-side Lagos proximity bias */
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
  }, []);

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
          const res = await fetchPlaceAutocomplete(q, {
            sessionToken: sessionTokenRef.current,
            latitude: userCoords?.latitude,
            longitude: userCoords?.longitude,
          });
          if (cancelled) return;
          if (!res.success) {
            setError(res.error?.message ?? "Search failed");
            setPredictions([]);
          } else {
            setError(null);
            if (res.sessionToken) sessionTokenRef.current = res.sessionToken;
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
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, userCoords]);

  function handlePick(prediction: PlacePrediction) {
    if (pickingRef.current) return;
    pickingRef.current = true;

    const previewAddress = predictionAddress(prediction);
    const sessionToken = prediction.session_token || sessionTokenRef.current;

    // Instant: close picker and show the chosen label while coords resolve.
    onSelect({
      address: previewAddress,
      latitude: Number.NaN,
      longitude: Number.NaN,
      placeId: prediction.place_id,
      resolving: true,
    });

    void (async () => {
      try {
        const detailsRes = await fetchPlaceDetails(prediction.place_id, sessionToken);
        sessionTokenRef.current = createPlacesSessionToken();

        if (!detailsRes.success || !detailsRes.data) {
          onSelectFailed?.(detailsRes.error?.message ?? "Could not load that place");
          return;
        }

        const place = detailsRes.data;
        onSelect({
          address: place.formatted_address || place.name || previewAddress,
          latitude: place.latitude,
          longitude: place.longitude,
          placeId: place.place_id,
          resolving: false,
        });
      } catch (err) {
        onSelectFailed?.(getApiErrorMessage(err, "Could not use that location"));
      }
    })();
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
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
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <label className="location-picker-search">
          <span className="sr-only">Search address</span>
          <input
            ref={inputRef}
            type="search"
            placeholder="Search places, streets, addresses…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
            <p className="muted location-picker-hint">
              Try a place name, street, landmark, or address.
            </p>
          ) : null}
          <ul className="location-picker-list">
            {predictions.map((p) => {
              const main = p.structured_formatting?.main_text || p.description;
              const secondary = p.structured_formatting?.secondary_text;
              const typeLabel = featureTypeLabel(p.feature_type, p.poi_categories);
              return (
                <li key={p.place_id}>
                  <button
                    type="button"
                    className="location-picker-item"
                    onClick={() => handlePick(p)}
                  >
                    <span className="location-picker-item-top">
                      <span className="location-picker-main">{main}</span>
                      <span className="location-picker-type">{typeLabel}</span>
                    </span>
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
  );
}
