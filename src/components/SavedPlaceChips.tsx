import type { SavedPlace } from "../types/api";
import { savedPlaceChipLabel } from "../lib/savedPlacesApi";

export function SavedPlaceChips({
  places,
  selectedId,
  onSelect,
  onManage,
}: {
  places: SavedPlace[];
  selectedId?: string | null;
  onSelect: (place: SavedPlace) => void;
  onManage?: () => void;
}) {
  if (places.length === 0 && !onManage) return null;

  return (
    <div className="saved-place-chips" role="list">
      {places.map((place) => (
        <button
          key={place.id}
          type="button"
          role="listitem"
          className={`saved-place-chip${selectedId === place.id ? " selected" : ""}`}
          onClick={() => onSelect(place)}
        >
          {savedPlaceChipLabel(place)}
        </button>
      ))}
      {onManage ? (
        <button type="button" className="saved-place-chip" onClick={onManage}>
          {places.length === 0 ? "+ Add place" : "Manage"}
        </button>
      ) : null}
    </div>
  );
}
