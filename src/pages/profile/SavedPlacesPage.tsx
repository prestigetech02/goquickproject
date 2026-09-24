import { useState, type FormEvent } from "react";
import { LocationPickerModal } from "../../components/LocationPickerModal";
import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { useToast } from "../../components/ToastProvider";
import { getApiErrorMessage } from "../../lib/http";
import type { LocationPoint } from "../../lib/placesApi";
import {
  useCreateSavedPlaceMutation,
  useDeleteSavedPlaceMutation,
  useSavedPlacesQuery,
  useUpdateSavedPlaceMutation,
} from "../../lib/queries";
import { savedPlaceChipLabel } from "../../lib/savedPlacesApi";
import type { SavedPlace } from "../../types/api";

const PRESETS = ["Home", "Work", "Office", "Market"];

type Draft = {
  id?: string;
  label: string;
  point: LocationPoint | null;
};

export function SavedPlacesPage() {
  const toast = useToast();
  const { data: places = [], isPending, error, refetch } = useSavedPlacesQuery();
  const createPlace = useCreateSavedPlaceMutation();
  const updatePlace = useUpdateSavedPlaceMutation();
  const deletePlace = useDeleteSavedPlaceMutation();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const usedLabels = places
    .filter((place) => place.id !== draft?.id)
    .map((place) => place.label.toLowerCase());

  function startAdd() {
    setDraft({ label: "", point: null });
  }

  function startEdit(place: SavedPlace) {
    setDraft({
      id: place.id,
      label: place.label,
      point: {
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        placeId: place.place_id ?? undefined,
        resolving: false,
      },
    });
  }

  async function handleDelete(place: SavedPlace) {
    const confirmed = window.confirm(`Remove ${place.label} from your saved places?`);
    if (!confirmed) return;
    try {
      await deletePlace.mutateAsync(place.id);
      toast.success("Place removed.");
      if (draft?.id === place.id) setDraft(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not remove place."));
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const label = draft.label.trim();
    if (!label) {
      toast.error("Give this place a name.");
      return;
    }
    if (!draft.point || draft.point.resolving || !Number.isFinite(draft.point.latitude)) {
      toast.error("Choose an address for this place.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label,
        address: draft.point.address,
        latitude: draft.point.latitude,
        longitude: draft.point.longitude,
        place_id: draft.point.placeId ?? null,
      };
      if (draft.id) {
        await updatePlace.mutateAsync({ id: draft.id, payload });
        toast.success("Place updated.");
      } else {
        await createPlace.mutateAsync(payload);
        toast.success("Place saved.");
      }
      setDraft(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not save place."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page profile-page">
      <ProfileSubHeader
        title="Saved places"
        action={
          <button type="button" className="btn-primary" onClick={startAdd}>
            Add place
          </button>
        }
      />

      <p className="muted">
        Save Home, Work, Market, or any custom address and pick them when you set your
        address or create an errand.
      </p>

      {error ? (
        <p className="error">
          Could not load saved places.{" "}
          <button type="button" className="linkish" onClick={() => void refetch()}>
            Retry
          </button>
        </p>
      ) : null}

      {draft ? (
        <form className="card stack profile-form" onSubmit={(e) => void handleSave(e)}>
          <h2 className="profile-card-title">{draft.id ? "Edit place" : "New place"}</h2>
          <div className="saved-place-chips">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`saved-place-chip${draft.label === preset ? " selected" : ""}`}
                disabled={usedLabels.includes(preset.toLowerCase())}
                onClick={() => setDraft({ ...draft, label: preset })}
              >
                {preset}
              </button>
            ))}
          </div>
          <label htmlFor="saved-place-label">Name</label>
          <input
            id="saved-place-label"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="Home, Office, Market…"
            maxLength={40}
            required
          />
          <button
            type="button"
            className="location-field-btn"
            onClick={() => setPickerOpen(true)}
          >
            <span className="muted">Address</span>
            <strong>
              {draft.point?.address || "Choose address"}
              {draft.point?.resolving ? "…" : ""}
            </strong>
          </button>
          <div className="saved-place-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : draft.id ? "Update place" : "Save place"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <section className="card stack">
        {isPending && places.length === 0 ? <p className="muted">Loading…</p> : null}
        {!isPending && places.length === 0 && !draft ? (
          <p className="profile-empty">No saved places yet. Add Home, Work, or any custom address.</p>
        ) : null}
        <ul className="saved-places-list">
          {places.map((place) => (
            <li key={place.id} className="saved-place-row">
              <div>
                <strong>{savedPlaceChipLabel(place)}</strong>
                <p className="muted">{place.address}</p>
              </div>
              <div className="saved-place-row-actions">
                <button type="button" className="btn-ghost" onClick={() => startEdit(place)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void handleDelete(place)}
                  disabled={deletePlace.isPending}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {pickerOpen ? (
        <LocationPickerModal
          title="Choose address"
          showSavedPlaces={false}
          onClose={() => setPickerOpen(false)}
          onSelect={(point) => {
            setDraft((current) => (current ? { ...current, point } : current));
            if (!point.resolving) setPickerOpen(false);
          }}
          onSelectFailed={(message) => toast.error(message)}
        />
      ) : null}
    </div>
  );
}
