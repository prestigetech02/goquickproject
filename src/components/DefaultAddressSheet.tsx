import { savedPlaceChipLabel } from "../lib/savedPlacesApi";
import type { DefaultAddress } from "../lib/defaultAddress";
import type { SavedPlace } from "../types/api";

type Props = {
  current: DefaultAddress | null;
  places: SavedPlace[];
  detecting?: boolean;
  onClose: () => void;
  onSelectCurrent: () => void;
  onSelectPlace: (place: SavedPlace) => void;
  onSearch: () => void;
  onManagePlaces: () => void;
};

export function DefaultAddressSheet({
  current,
  places,
  detecting = false,
  onClose,
  onSelectCurrent,
  onSelectPlace,
  onSearch,
  onManagePlaces,
}: Props) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel default-address-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="default-address-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <h2 id="default-address-title" className="notification-modal-title" style={{ margin: 0 }}>
            Your address
          </h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="muted" style={{ margin: "0 0 12px" }}>
          Choose a saved place or search for an address.
        </p>

        <ul className="default-address-options">
          {places.length === 0 ? (
            <li>
              <button type="button" className="default-address-option" onClick={onManagePlaces}>
                <span className="default-address-option-title">Add saved places</span>
                <span className="muted default-address-option-sub">
                  Save Home, Work, and other frequent addresses
                </span>
              </button>
            </li>
          ) : (
            places.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  className={`default-address-option${
                    current?.kind === "place" && current.placeId === place.id ? " selected" : ""
                  }`}
                  onClick={() => onSelectPlace(place)}
                >
                  <span className="default-address-option-title">{savedPlaceChipLabel(place)}</span>
                  <span className="muted default-address-option-sub">{place.address}</span>
                </button>
              </li>
            ))
          )}
          <li>
            <button
              type="button"
              className={`default-address-option${current?.kind === "current" ? " selected" : ""}`}
              onClick={onSelectCurrent}
              disabled={detecting}
            >
              <span className="default-address-option-title">
                {detecting ? "Detecting…" : "Current location"}
              </span>
              <span className="muted default-address-option-sub">
                {current?.kind === "current" ? current.address : "Use GPS where you are now"}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`default-address-option${current?.kind === "custom" ? " selected" : ""}`}
              onClick={onSearch}
            >
              <span className="default-address-option-title">Search address</span>
              <span className="muted default-address-option-sub">
                {current?.kind === "custom" ? current.address : "Find a street, landmark, or place"}
              </span>
            </button>
          </li>
        </ul>

        {places.length > 0 ? (
          <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={onManagePlaces}>
            Manage saved places
          </button>
        ) : null}
      </div>
    </div>
  );
}
