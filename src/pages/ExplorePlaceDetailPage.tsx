import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { loadDefaultAddress } from "../lib/defaultAddress";
import { getStoredUser } from "../lib/auth";
import { isProfileComplete } from "../types/api";
import {
  distanceKm,
  errandTypeForPlaceCategory,
  exploreCategoryLabel,
  exploreFullAddress,
  formatDistanceKm,
  getExplorePlace,
  type ExplorePrefillState,
} from "../lib/explorePlaces";

const MAX_THUMBS = 6;

export function ExplorePlaceDetailPage() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const id = Number(placeId);
  const place = Number.isFinite(id) ? getExplorePlace(id) : null;
  const [activeIndex, setActiveIndex] = useState(0);

  if (!place) {
    return <Navigate to="/explore" replace />;
  }

  const images = place.images.slice(0, MAX_THUMBS);
  const activeImage = images[activeIndex] ?? images[0] ?? null;
  const origin = loadDefaultAddress();
  const km =
    origin && Number.isFinite(origin.latitude) && Number.isFinite(origin.longitude)
      ? distanceKm({ latitude: origin.latitude, longitude: origin.longitude }, place)
      : null;

  function startErrand() {
    if (!isProfileComplete(getStoredUser())) {
      navigate("/complete-profile", { state: { reason: "post_errand" } });
      return;
    }

    const errandType = errandTypeForPlaceCategory(place!.category);
    const prefill: ExplorePrefillState = {
      placeId: place!.id,
      placeName: place!.name,
      pickupAddress: exploreFullAddress(place!),
      pickupLatitude: place!.latitude,
      pickupLongitude: place!.longitude,
      description: `Errand at ${place!.name}. ${place!.description}`.trim(),
      errandType,
    };

    navigate(`/errands/new?type=${encodeURIComponent(errandType)}`, {
      state: { explorePlace: prefill },
    });
  }

  return (
    <div className="page explore-detail-page">
      <Link to="/explore" className="explore-back muted">
        ← Back to Explore
      </Link>

      <header className="explore-detail-header">
        <p className="explore-card-category">{exploreCategoryLabel(place.category)}</p>
        <h1>{place.name}</h1>
        <p className="explore-detail-meta muted">
          {place.area}
          {place.city ? ` · ${place.city}` : ""}
          {place.state ? ` · ${place.state}` : ""}
          {km != null ? ` · ${formatDistanceKm(km)} away` : ""}
        </p>
      </header>

      <div className="explore-detail-gallery">
        {activeImage ? (
          <img src={activeImage} alt="" className="explore-detail-main" />
        ) : (
          <div className="explore-detail-fallback">{place.name.slice(0, 1)}</div>
        )}

        {images.length > 1 ? (
          <div className="explore-detail-thumbs" role="listbox" aria-label="Place photos">
            {images.map((src, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={`${index}-${src}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`explore-detail-thumb${active ? " is-active" : ""}`}
                  onClick={() => setActiveIndex(index)}
                >
                  <img src={src} alt="" />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <section className="explore-detail-section">
        <h2>About</h2>
        <p>{place.description}</p>
      </section>

      <section className="explore-detail-section">
        <h2>Address</h2>
        <p>{exploreFullAddress(place)}</p>
        {place.phone ? (
          <p className="muted">
            Phone:{" "}
            <a href={`tel:${place.phone}`} className="explore-phone">
              {place.phone}
            </a>
          </p>
        ) : null}
      </section>

      <div className="explore-detail-actions">
        <button type="button" className="btn-primary explore-cta" onClick={startErrand}>
          Create errand here
        </button>
        <p className="muted explore-cta-hint">Opens New errand with this place as pickup.</p>
      </div>
    </div>
  );
}
