import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { fetchExploreCategories, fetchExplorePlace } from "../lib/exploreApi";
import { loadDefaultAddress } from "../lib/defaultAddress";
import { getStoredUser } from "../lib/auth";
import { getApiErrorMessage } from "../lib/http";
import { queryKeys } from "../lib/queryClient";
import { isProfileComplete } from "../types/api";
import {
  errandTypeForPlaceCategory,
  exploreCategoryLabel,
  exploreFullAddress,
  formatDistanceKm,
  type ExplorePrefillState,
} from "../lib/explorePlaces";

const MAX_THUMBS = 6;

export function ExplorePlaceDetailPage() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const id = Number(placeId);
  const [activeIndex, setActiveIndex] = useState(0);

  const origin = useMemo(() => {
    const saved = loadDefaultAddress();
    if (!saved || !Number.isFinite(saved.latitude) || !Number.isFinite(saved.longitude)) return null;
    return { latitude: saved.latitude, longitude: saved.longitude };
  }, []);

  const placeQuery = useQuery({
    queryKey: queryKeys.explorePlace(id),
    queryFn: () => fetchExplorePlace(id, origin),
    enabled: Number.isFinite(id) && id > 0,
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.exploreCategories,
    queryFn: fetchExploreCategories,
    staleTime: 60_000,
  });

  if (!Number.isFinite(id) || id <= 0) {
    return <Navigate to="/explore" replace />;
  }

  if (placeQuery.isError) {
    return <Navigate to="/explore" replace />;
  }

  if (placeQuery.isLoading || !placeQuery.data) {
    return (
      <div className="page explore-detail-page">
        <Link to="/explore" className="explore-back muted">
          ← Back to Explore
        </Link>
        <p className="muted">{placeQuery.isLoading ? "Loading place…" : getApiErrorMessage(placeQuery.error)}</p>
      </div>
    );
  }

  const place = placeQuery.data;
  const categories = categoriesQuery.data ?? [];
  const images = place.images.slice(0, MAX_THUMBS);
  const activeImage = images[activeIndex] ?? images[0] ?? null;
  const km = place.distance_km;

  function startErrand() {
    if (!isProfileComplete(getStoredUser())) {
      navigate("/complete-profile", { state: { reason: "post_errand" } });
      return;
    }

    const errandType = errandTypeForPlaceCategory(place.category);
    const prefill: ExplorePrefillState = {
      placeId: place.id,
      placeName: place.name,
      pickupAddress: exploreFullAddress(place),
      pickupLatitude: place.latitude,
      pickupLongitude: place.longitude,
      description: `Errand at ${place.name}. ${place.description}`.trim(),
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
        <p className="explore-card-category">{exploreCategoryLabel(place.category, categories)}</p>
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
          <div className="explore-detail-thumbs" role="list">
            {images.map((src, index) => (
              <button
                key={`${src}-${index}`}
                type="button"
                role="listitem"
                className={`explore-detail-thumb${index === activeIndex ? " is-active" : ""}`}
                onClick={() => setActiveIndex(index)}
                aria-label={`Photo ${index + 1}`}
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <section className="explore-detail-body">
        <p>{place.description}</p>
        <p className="muted">{exploreFullAddress(place)}</p>
        {place.phone ? <p className="muted">Phone: {place.phone}</p> : null}
      </section>

      <button type="button" className="btn-primary explore-detail-cta" onClick={startErrand}>
        Start errand here
      </button>
    </div>
  );
}
