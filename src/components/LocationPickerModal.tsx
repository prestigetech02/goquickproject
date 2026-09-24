import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CustomPinMap } from "./CustomPinMap";
import { SavedPlaceChips } from "./SavedPlaceChips";
import { ServiceZoneUnavailableModal } from "./ServiceZoneUnavailableModal";
import { getApiErrorMessage } from "../lib/http";
import {
  checkLocationServiceability,
  createPlacesSessionToken,
  featureTypeLabel,
  fetchPlaceAutocomplete,
  fetchPlaceDetails,
  type LocationPoint,
  type PlacePrediction,
} from "../lib/placesApi";
import { locationPointFromSavedPlace } from "../lib/savedPlacesApi";
import { useSavedPlacesQuery } from "../lib/queries";
import type { SavedPlace } from "../types/api";

type Props = {
  title: string;
  onClose: () => void;
  onSelect: (point: LocationPoint) => void;
  /** Called if details fail after an optimistic select (modal already closed). */
  onSelectFailed?: (message: string) => void;
  showSavedPlaces?: boolean;
};

type UserCoords = { latitude: number; longitude: number };
type Mode = "search" | "custom";

const LAGOS = { latitude: 6.5244, longitude: 3.3792 };

function predictionAddress(prediction: PlacePrediction): string {
  const main = prediction.structured_formatting?.main_text?.trim();
  const secondary = prediction.structured_formatting?.secondary_text?.trim();
  if (main && secondary) return `${main}, ${secondary}`;
  if (main) return main;
  return prediction.description;
}

export function LocationPickerModal({
  title,
  onClose,
  onSelect,
  onSelectFailed,
  showSavedPlaces = true,
}: Props) {
  const navigate = useNavigate();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef(createPlacesSessionToken());
  const pickingRef = useRef(false);
  const { data: savedPlaces = [] } = useSavedPlacesQuery();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [zoneBlockedName, setZoneBlockedName] = useState<string | null>(null);

  const [customLabel, setCustomLabel] = useState("");
  const [pinLat, setPinLat] = useState(LAGOS.latitude);
  const [pinLng, setPinLng] = useState(LAGOS.longitude);
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "search") inputRef.current?.focus();
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
  }, [onClose, mode]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setUserCoords(coords);
        setPinLat(coords.latitude);
        setPinLng(coords.longitude);
      },
      () => {
        /* server-side Lagos proximity bias */
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
  }, []);

  useEffect(() => {
    if (mode !== "search") return;
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
  }, [query, userCoords, mode]);

  async function ensureServiceable(latitude: number, longitude: number): Promise<boolean> {
    try {
      const res = await checkLocationServiceability(latitude, longitude);
      if (!res.success) {
        onSelectFailed?.(res.error?.message ?? "Could not verify service area");
        return false;
      }
      if (!res.data.serviceable) {
        setZoneBlockedName(res.data.zone_name || "this area");
        return false;
      }
      return true;
    } catch (err) {
      onSelectFailed?.(getApiErrorMessage(err, "Could not verify service area"));
      return false;
    }
  }

  function handleSavedPlace(place: SavedPlace) {
    if (pickingRef.current) return;
    pickingRef.current = true;
    void (async () => {
      try {
        const ok = await ensureServiceable(place.latitude, place.longitude);
        if (!ok) return;
        onSelect(locationPointFromSavedPlace(place));
      } catch (err) {
        onSelectFailed?.(getApiErrorMessage(err, "Could not use that location"));
      } finally {
        pickingRef.current = false;
      }
    })();
  }

  function handlePick(prediction: PlacePrediction) {
    if (pickingRef.current) return;
    pickingRef.current = true;

    const previewAddress = predictionAddress(prediction);
    const sessionToken = prediction.session_token || sessionTokenRef.current;

    onSelect({
      address: previewAddress,
      latitude: Number.NaN,
      longitude: Number.NaN,
      placeId: prediction.place_id,
      resolving: true,
      isCustom: false,
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
        const ok = await ensureServiceable(place.latitude, place.longitude);
        if (!ok) {
          onSelectFailed?.("This location is outside our service zones.");
          return;
        }

        onSelect({
          address: place.formatted_address || place.name || previewAddress,
          latitude: place.latitude,
          longitude: place.longitude,
          placeId: place.place_id,
          resolving: false,
          isCustom: false,
        });
      } catch (err) {
        onSelectFailed?.(getApiErrorMessage(err, "Could not use that location"));
      } finally {
        pickingRef.current = false;
      }
    })();
  }

  function handleConfirmCustom() {
    const label = customLabel.trim();
    if (label.length < 3) {
      setCustomError("Enter a short address or landmark description.");
      return;
    }
    if (!Number.isFinite(pinLat) || !Number.isFinite(pinLng)) {
      setCustomError("Drop a pin on the map.");
      return;
    }
    setCustomError(null);
    void (async () => {
      const ok = await ensureServiceable(pinLat, pinLng);
      if (!ok) {
        setCustomError("This location is outside our service zones.");
        return;
      }
      onSelect({
        address: label,
        latitude: pinLat,
        longitude: pinLng,
        resolving: false,
        isCustom: true,
      });
    })();
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setCustomError("Location is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPinLat(pos.coords.latitude);
        setPinLng(pos.coords.longitude);
        setCustomError(null);
      },
      () => setCustomError("Could not get your current location."),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  return (
    <>
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal-panel location-picker-modal${mode === "custom" ? " custom-mode" : ""}`}
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

        <div className="location-picker-mode" role="tablist" aria-label="Location method">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "search"}
            className={`location-picker-mode-btn${mode === "search" ? " selected" : ""}`}
            onClick={() => setMode("search")}
          >
            Search
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "custom"}
            className={`location-picker-mode-btn${mode === "custom" ? " selected" : ""}`}
            onClick={() => setMode("custom")}
          >
            Custom address
          </button>
        </div>

        {mode === "search" ? (
          <>
            {showSavedPlaces ? (
              <SavedPlaceChips
                places={savedPlaces}
                onSelect={handleSavedPlace}
                onManage={() => {
                  onClose();
                  navigate("/profile/places");
                }}
              />
            ) : null}

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
                <p className="muted location-picker-hint">
                  No places found.{" "}
                  <button type="button" className="location-picker-link" onClick={() => setMode("custom")}>
                    Enter a custom address
                  </button>
                </p>
              ) : null}
              {!loading && query.trim().length < 2 ? (
                showSavedPlaces && savedPlaces.length > 0 ? (
                  <ul className="location-picker-list">
                    {savedPlaces.map((place) => (
                      <li key={place.id}>
                        <button
                          type="button"
                          className="location-picker-item"
                          onClick={() => handleSavedPlace(place)}
                        >
                          <span className="location-picker-item-top">
                            <span className="location-picker-main">{place.label}</span>
                            <span className="location-picker-type">Saved</span>
                          </span>
                          <span className="location-picker-secondary muted">{place.address}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted location-picker-hint">
                    Try a place name, street, landmark, or address. Can&apos;t find it?{" "}
                    <button type="button" className="location-picker-link" onClick={() => setMode("custom")}>
                      Use custom address
                    </button>
                  </p>
                )
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
          </>
        ) : (
          <div className="location-picker-custom stack">
            <label>
              <span className="label">Address / landmark</span>
              <textarea
                rows={2}
                placeholder="e.g. Opposite Shoprite Magodo, second gate after the red fence"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                maxLength={255}
              />
            </label>

            <div className="location-picker-pin-actions">
              <p className="muted location-picker-hint" style={{ margin: 0 }}>
                Drag the pin or tap the map so runners know exactly where to go.
              </p>
              <button type="button" className="btn-secondary location-picker-geo-btn" onClick={useMyLocation}>
                Use my location
              </button>
            </div>

            <CustomPinMap
              latitude={pinLat}
              longitude={pinLng}
              onMove={(lat, lng) => {
                setPinLat(lat);
                setPinLng(lng);
              }}
            />

            <p className="muted location-picker-coords">
              Pin: {pinLat.toFixed(5)}, {pinLng.toFixed(5)}
            </p>

            {customError ? <p className="error">{customError}</p> : null}

            <button type="button" className="btn-primary" onClick={handleConfirmCustom}>
              Use this location
            </button>
          </div>
        )}
      </div>
    </div>
    {zoneBlockedName ? (
      <ServiceZoneUnavailableModal
        zoneName={zoneBlockedName}
        onClose={() => setZoneBlockedName(null)}
      />
    ) : null}
    </>
  );
}
