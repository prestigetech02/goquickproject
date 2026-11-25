import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchExploreCategories, fetchExplorePlaces } from "../lib/exploreApi";
import { loadDefaultAddress } from "../lib/defaultAddress";
import {
  exploreCategoryLabel,
  exploreCover,
  formatDistanceKm,
} from "../lib/explorePlaces";
import { getApiErrorMessage } from "../lib/http";
import { queryKeys } from "../lib/queryClient";

export function ExplorePlacesPage() {
  const origin = useMemo(() => {
    const saved = loadDefaultAddress();
    if (!saved || !Number.isFinite(saved.latitude) || !Number.isFinite(saved.longitude)) return null;
    return { latitude: saved.latitude, longitude: saved.longitude };
  }, []);

  const [category, setCategory] = useState<string>("all");
  const [area, setArea] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftArea, setDraftArea] = useState("all");
  const [draftCategory, setDraftCategory] = useState("all");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.exploreCategories,
    queryFn: fetchExploreCategories,
    staleTime: 60_000,
  });

  const placesQuery = useQuery({
    queryKey: queryKeys.explorePlaces({
      category: category === "all" ? null : category,
      area: area === "all" ? null : area,
      query: debouncedQuery || null,
      origin,
    }),
    queryFn: () =>
      fetchExplorePlaces({
        category: category === "all" ? null : category,
        area: area === "all" ? null : area,
        query: debouncedQuery || null,
        origin,
      }),
    staleTime: 30_000,
  });

  const categories = categoriesQuery.data ?? [];
  const places = placesQuery.data?.places ?? [];
  const areas = placesQuery.data?.areas ?? [];
  const filtersActive = category !== "all" || area !== "all";
  const loading = categoriesQuery.isLoading || placesQuery.isLoading;
  const error = categoriesQuery.error ?? placesQuery.error;

  useEffect(() => {
    if (!filtersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  function openFilters() {
    setDraftArea(area);
    setDraftCategory(category);
    setFiltersOpen(true);
  }

  function applyFilters() {
    setArea(draftArea);
    setCategory(draftCategory);
    setFiltersOpen(false);
  }

  function clearFilters() {
    setDraftArea("all");
    setDraftCategory("all");
    setArea("all");
    setCategory("all");
    setFiltersOpen(false);
  }

  return (
    <div className="page explore-page">
      <header className="page-header-row explore-header">
        <div className="explore-header-copy">
          <div className="explore-header-top">
            <p className="muted explore-eyebrow">Discover</p>
            <button
              type="button"
              className={`explore-filter-text-btn${filtersActive ? " has-filters" : ""}`}
              onClick={openFilters}
            >
              Filter
              {filtersActive ? <span className="explore-filter-count" aria-hidden>•</span> : null}
            </button>
          </div>
          <h1>Explore places</h1>
          <p className="muted">
            Pick a shop or stop near you, then start an errand with pickup already filled in.
          </p>
        </div>
      </header>

      <div className="explore-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or area…"
          aria-label="Search places"
        />
      </div>

      <div className="explore-chips" role="tablist" aria-label="Categories">
        <button
          type="button"
          role="tab"
          aria-selected={category === "all"}
          className={`explore-chip${category === "all" ? " is-active" : ""}`}
          onClick={() => setCategory("all")}
        >
          All
        </button>
        {categories.map((item) => (
          <button
            key={item.slug}
            type="button"
            role="tab"
            aria-selected={category === item.slug}
            className={`explore-chip${category === item.slug ? " is-active" : ""}`}
            onClick={() => setCategory(item.slug)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <p className="muted explore-sort-hint">
        {origin ? "Sorted by distance from your address" : "Set your address on Home to sort by distance"}
        {area !== "all" ? ` · Area: ${area}` : ""}
      </p>

      {error ? (
        <div className="explore-empty">
          <p className="explore-empty-title">Could not load places</p>
          <p className="muted">{getApiErrorMessage(error, "Try again in a moment.")}</p>
        </div>
      ) : loading ? (
        <div className="explore-empty">
          <p className="muted">Loading places…</p>
        </div>
      ) : places.length === 0 ? (
        <div className="explore-empty">
          <p className="explore-empty-title">No places match</p>
          <p className="muted">Try another category, area, or search term.</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setCategory("all");
              setArea("all");
              setQuery("");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="explore-grid">
          {places.map((place) => {
            const cover = exploreCover(place);
            return (
              <li key={place.id}>
                <Link to={`/explore/${place.id}`} className="explore-card">
                  <span className="explore-card-media">
                    {cover ? (
                      <img src={cover} alt="" loading="lazy" />
                    ) : (
                      <span className="explore-card-fallback" aria-hidden>
                        {place.name.slice(0, 1)}
                      </span>
                    )}
                    {place.distance_km != null ? (
                      <span className="explore-card-distance">{formatDistanceKm(place.distance_km)}</span>
                    ) : null}
                  </span>
                  <span className="explore-card-body">
                    <span className="explore-card-category">
                      {exploreCategoryLabel(place.category, categories)}
                    </span>
                    <span className="explore-card-name">{place.name}</span>
                    <span className="explore-card-area muted">
                      {place.area}
                      {place.city && place.city !== place.area ? ` · ${place.city}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {filtersOpen ? (
        <div className="modal-backdrop explore-filter-backdrop" onClick={() => setFiltersOpen(false)}>
          <div
            className="explore-filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filter places"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="explore-filter-sheet-handle" aria-hidden />
            <div className="explore-filter-sheet-head">
              <h2>Filters</h2>
              <button type="button" className="explore-filter-sheet-close" onClick={() => setFiltersOpen(false)}>
                Close
              </button>
            </div>

            <label className="explore-filter-field">
              <span>Category</span>
              <select value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="explore-filter-field">
              <span>Area</span>
              <select value={draftArea} onChange={(e) => setDraftArea(e.target.value)}>
                <option value="all">All areas</option>
                {areas.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <div className="explore-filter-sheet-actions">
              <button type="button" className="btn-secondary" onClick={clearFilters}>
                Clear
              </button>
              <button type="button" className="btn-primary" onClick={applyFilters}>
                Apply filters
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
