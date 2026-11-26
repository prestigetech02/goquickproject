import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { LocationPickerModal } from "../../components/LocationPickerModal";
import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { useToast } from "../../components/ToastProvider";
import { getStoredUser } from "../../lib/auth";
import { getApiErrorMessage } from "../../lib/http";
import {
  createOrganizationLocation,
  deleteOrganizationLocation,
  fetchOrganizationLocations,
  type OrganizationLocation,
} from "../../lib/organizationApi";
import type { LocationPoint } from "../../lib/placesApi";
import { useProfileQuery } from "../../lib/queries";
import { userOwnsBusiness } from "../../types/api";

type Draft = {
  name: string;
  point: LocationPoint | null;
};

export function BusinessBranchesPage() {
  const toast = useToast();
  const stored = getStoredUser();
  const { data: profile } = useProfileQuery();
  const user = profile ?? stored;
  const owned = (user?.organizations ?? []).find((o) => o.role === "owner") ?? null;

  const [locations, setLocations] = useState<OrganizationLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!owned) return;
    let cancelled = false;
    setLoading(true);
    void fetchOrganizationLocations(owned.id)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data?.locations) {
          setLocations(res.data.locations);
        } else {
          toast.error(res.error?.message ?? "Could not load branches.");
        }
      })
      .catch((err) => {
        if (!cancelled) toast.error(getApiErrorMessage(err, "Could not load branches."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [owned?.id, toast]);

  if (!userOwnsBusiness(user)) {
    return <Navigate to="/profile" replace />;
  }

  if (!owned) {
    return <Navigate to="/profile" replace />;
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!draft || !owned) return;
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give this branch a name.");
      return;
    }
    if (!draft.point || draft.point.resolving || !Number.isFinite(draft.point.latitude)) {
      toast.error("Choose an address for this branch.");
      return;
    }
    setSaving(true);
    try {
      const res = await createOrganizationLocation(owned.id, {
        name,
        address: draft.point.address,
        latitude: draft.point.latitude,
        longitude: draft.point.longitude,
      });
      if (!res.success || !res.data?.location) {
        toast.error(res.error?.message ?? "Could not save branch.");
        return;
      }
      setLocations((prev) => [...prev, res.data!.location].sort((a, b) => a.sort_order - b.sort_order));
      setDraft(null);
      toast.success("Branch saved.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not save branch."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(loc: OrganizationLocation) {
    if (!owned) return;
    const confirmed = window.confirm(`Remove branch “${loc.name}”?`);
    if (!confirmed) return;
    try {
      const res = await deleteOrganizationLocation(owned.id, loc.id);
      if (!res.success) {
        toast.error(res.error?.message ?? "Could not remove branch.");
        return;
      }
      setLocations((prev) => prev.filter((l) => l.id !== loc.id));
      toast.success("Branch removed.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not remove branch."));
    }
  }

  return (
    <div className="page profile-page">
      <ProfileSubHeader
        title="Business branches"
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setDraft({ name: "", point: null })}
          >
            Add branch
          </button>
        }
      />

      <p className="muted">
        Branches belong to <strong>{owned.name}</strong>. When you create an errand as the
        business, you can tag which branch it is for.
      </p>

      {loading ? <p className="muted">Loading branches…</p> : null}

      {!loading && locations.length === 0 && !draft ? (
        <p className="muted">No branches yet. Add your first location.</p>
      ) : null}

      <ul className="saved-places-list">
        {locations.map((loc) => (
          <li key={loc.id} className="card saved-place-row">
            <div>
              <strong>{loc.name}</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {loc.address}
              </p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => void handleDelete(loc)}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      {draft ? (
        <form className="card stack" onSubmit={(e) => void handleSave(e)}>
          <h2 className="profile-card-title">New branch</h2>
          <label className="stack">
            <span className="muted">Branch name</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Lekki store"
              autoFocus
            />
          </label>
          <button
            type="button"
            className="location-field-btn"
            onClick={() => setPickerOpen(true)}
          >
            <span className="muted">Address</span>
            <strong>
              {draft.point?.address || "Choose location"}
              {draft.point?.resolving ? "…" : ""}
            </strong>
          </button>
          <div className="row" style={{ gap: 8 }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save branch"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={saving}
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {pickerOpen ? (
        <LocationPickerModal
          title="Branch address"
          showSavedPlaces={false}
          onClose={() => setPickerOpen(false)}
          onSelect={(point) => {
            setDraft((d) => (d ? { ...d, point } : d));
            if (!point.resolving) setPickerOpen(false);
          }}
          onSelectFailed={(message) => toast.error(message)}
        />
      ) : null}
    </div>
  );
}
