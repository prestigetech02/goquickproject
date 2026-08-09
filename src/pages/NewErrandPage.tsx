import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ErrandCreatedModal } from "../components/ErrandCreatedModal";
import { LocationPickerModal } from "../components/LocationPickerModal";
import { getStoredUser } from "../lib/auth";
import {
  estimateErrand,
  type CreateErrandResult,
  type ErrandEstimate,
  type ErrandTypeSchema,
} from "../lib/errandApi";
import { getApiErrorMessage } from "../lib/http";
import { useCreateErrandMutation, useErrandTypeSchemasQuery } from "../lib/queries";
import type { LocationPoint } from "../lib/placesApi";
import { isProfileComplete } from "../types/api";
import { formatNaira } from "../types/errand";

const FALLBACK_TYPES: ErrandTypeSchema[] = [
  {
    id: 1,
    slug: "shopping",
    name: "Shopping",
    description: "Groceries, market runs, small items.",
  },
  {
    id: 2,
    slug: "pickup_drop",
    name: "Pickup & Drop",
    description: "Pick up packages and deliver safely.",
  },
  {
    id: 3,
    slug: "queue",
    name: "Queue for me",
    description: "Let a runner stand in line on your behalf.",
  },
  {
    id: 4,
    slug: "custom",
    name: "Custom errand",
    description: "Anything else you need help with.",
  },
];

const DASHBOARD_SLUGS = new Set(["shopping", "pickup_drop", "queue", "custom", "delivery"]);

type LocationField = "pickup" | "dropoff";

function needsDropoff(slug: string) {
  return !["queue", "domestic"].includes(slug);
}

function pickupLabel(slug: string) {
  switch (slug) {
    case "shopping":
      return "Where to shop";
    case "queue":
      return "Where to queue";
    case "custom":
      return "Errand location";
    default:
      return "Pickup location";
  }
}

function dropoffLabel(slug: string) {
  switch (slug) {
    case "shopping":
      return "Where to deliver";
    case "custom":
      return "Destination";
    default:
      return "Drop-off location";
  }
}

function buildTitle(slug: string, description: string, typeName: string) {
  const trimmed = description.trim();
  if (trimmed) return trimmed.slice(0, 120);
  switch (slug) {
    case "shopping":
      return "Shopping errand";
    case "pickup_drop":
    case "delivery":
      return "Pickup & drop";
    case "queue":
      return "Queue for me";
    default:
      return typeName || "Custom errand";
  }
}

export function NewErrandPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type")?.trim() || "custom";

  const schemasQ = useErrandTypeSchemasQuery();
  const create = useCreateErrandMutation();

  const types = useMemo(() => {
    const schemas = schemasQ.data ?? [];
    if (schemas.length === 0) return FALLBACK_TYPES;
    const preferred = schemas.filter((s) => DASHBOARD_SLUGS.has(s.slug));
    return preferred.length > 0 ? preferred : schemas;
  }, [schemasQ.data]);

  const [category, setCategory] = useState(initialType);
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [dropoff, setDropoff] = useState<LocationPoint | null>(null);
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [timing, setTiming] = useState<"asap" | "scheduled">("asap");
  const [scheduledAt, setScheduledAt] = useState("");
  const [waitMinutes, setWaitMinutes] = useState("");
  const [picker, setPicker] = useState<LocationField | null>(null);
  const [estimate, setEstimate] = useState<ErrandEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateErrandResult | null>(null);

  useEffect(() => {
    if (!isProfileComplete(getStoredUser())) {
      navigate("/complete-profile", { replace: true, state: { reason: "post_errand" } });
    }
  }, [navigate]);

  useEffect(() => {
    if (types.some((t) => t.slug === initialType)) {
      setCategory(initialType);
    } else if (types[0]) {
      setCategory(types[0].slug);
    }
  }, [types, initialType]);

  const selectedType = types.find((t) => t.slug === category) ?? types[0];
  const showDropoff = needsDropoff(category);

  useEffect(() => {
    if (!showDropoff) setDropoff(null);
  }, [showDropoff]);

  useEffect(() => {
    if (!pickup || !showDropoff || !dropoff) {
      setEstimate(null);
      setZoneError(null);
      setEstimateLoading(false);
      return;
    }

    let cancelled = false;
    setEstimateLoading(true);
    setZoneError(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await estimateErrand({
          category,
          pickup_latitude: pickup.latitude,
          pickup_longitude: pickup.longitude,
          dropoff_latitude: dropoff.latitude,
          dropoff_longitude: dropoff.longitude,
        });
        if (cancelled) return;
        setEstimateLoading(false);
        if (!res.success || !res.data) {
          if (res.error?.code === "ZONE_NOT_SERVICEABLE") {
            setZoneError(res.error.message ?? "This route is outside our service zones.");
            setEstimate(null);
          } else {
            setZoneError(null);
            setEstimate(null);
            setFormError(res.error?.message ?? "Could not estimate price.");
          }
          return;
        }
        setFormError(null);
        setEstimate(res.data);
        if (!res.data.service_zone?.serviceable) {
          setZoneError("This route is outside our service zones.");
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pickup, dropoff, category, showDropoff]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!pickup) {
      setFormError("Choose a pickup location.");
      return;
    }
    if (showDropoff && !dropoff) {
      setFormError("Choose a drop-off location.");
      return;
    }
    if (zoneError) {
      setFormError(zoneError);
      return;
    }
    if (category === "queue") {
      const mins = Number(waitMinutes);
      if (!Number.isFinite(mins) || mins <= 0) {
        setFormError("Enter expected wait time in minutes.");
        return;
      }
    }
    if (timing === "scheduled" && !scheduledAt) {
      setFormError("Choose a scheduled date and time.");
      return;
    }

    const metadata: Record<string, unknown> = {};
    if (instructions.trim()) metadata.instructions = instructions.trim();
    if (category === "queue") metadata.expected_wait_minutes = Number(waitMinutes);

    try {
      const result = await create.mutateAsync({
        title: buildTitle(category, description, selectedType?.name ?? "Errand"),
        description: description.trim() || null,
        category,
        type: timing === "scheduled" ? "scheduled" : "instant",
        scheduled_at: timing === "scheduled" ? new Date(scheduledAt).toISOString() : null,
        budget_min: null,
        budget_max: null,
        pickup_address: pickup.address,
        pickup_latitude: pickup.latitude,
        pickup_longitude: pickup.longitude,
        dropoff_address: showDropoff ? dropoff?.address ?? null : null,
        dropoff_latitude: showDropoff ? dropoff?.latitude ?? null : null,
        dropoff_longitude: showDropoff ? dropoff?.longitude ?? null : null,
        metadata: Object.keys(metadata).length ? metadata : null,
      });
      setCreated(result);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === "INSUFFICIENT_BALANCE") {
        setFormError("Insufficient wallet balance. Fund your wallet, then try again.");
      } else if (code === "ZONE_NOT_SERVICEABLE") {
        setFormError(getApiErrorMessage(err, "This location is outside our service zones."));
      } else {
        setFormError(getApiErrorMessage(err, "Could not create errand."));
      }
    }
  }

  const estimatePrice =
    estimate?.suggested_price != null
      ? estimate.suggested_price.min === estimate.suggested_price.max
        ? formatNaira(estimate.suggested_price.min)
        : `${formatNaira(estimate.suggested_price.min)} – ${formatNaira(estimate.suggested_price.max)}`
      : null;

  return (
    <div className="page new-errand-page">
      <div className="page-header-row">
        <div>
          <Link to="/errands" className="profile-back">
            ← Back
          </Link>
          <h1>New errand</h1>
        </div>
      </div>

      <form className="new-errand-form stack" onSubmit={(e) => void handleSubmit(e)}>
        <section className="card stack">
          <h2 className="profile-card-title">Errand type</h2>
          <div className="new-errand-types" role="radiogroup" aria-label="Errand type">
            {types.map((t) => (
              <button
                key={t.slug}
                type="button"
                role="radio"
                aria-checked={category === t.slug}
                className={`new-errand-type${category === t.slug ? " selected" : ""}`}
                onClick={() => setCategory(t.slug)}
              >
                <strong>{t.name}</strong>
                {t.description ? <span className="muted">{t.description}</span> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="card stack">
          <h2 className="profile-card-title">Locations</h2>
          <button
            type="button"
            className="location-field-btn"
            onClick={() => setPicker("pickup")}
          >
            <span className="muted">{pickupLabel(category)}</span>
            <strong>{pickup?.address || "Choose location"}</strong>
          </button>
          {showDropoff ? (
            <button
              type="button"
              className="location-field-btn"
              onClick={() => setPicker("dropoff")}
            >
              <span className="muted">{dropoffLabel(category)}</span>
              <strong>{dropoff?.address || "Choose location"}</strong>
            </button>
          ) : null}
        </section>

        <section className="card stack">
          <h2 className="profile-card-title">Details</h2>
          <label>
            <span className="label">Description</span>
            <textarea
              rows={3}
              placeholder="What should the runner do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          {category === "queue" ? (
            <label>
              <span className="label">Expected wait (minutes)</span>
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="e.g. 45"
                value={waitMinutes}
                onChange={(e) => setWaitMinutes(e.target.value)}
                required
              />
            </label>
          ) : null}

          <label>
            <span className="label">Any other instructions</span>
            <textarea
              rows={2}
              placeholder="Gate code, contact notes, urgency…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>

          <div className="new-errand-timing" role="radiogroup" aria-label="Preferred time">
            <button
              type="button"
              role="radio"
              aria-checked={timing === "asap"}
              className={`new-errand-timing-btn${timing === "asap" ? " selected" : ""}`}
              onClick={() => setTiming("asap")}
            >
              ASAP
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={timing === "scheduled"}
              className={`new-errand-timing-btn${timing === "scheduled" ? " selected" : ""}`}
              onClick={() => setTiming("scheduled")}
            >
              Schedule
            </button>
          </div>
          {timing === "scheduled" ? (
            <label>
              <span className="label">Date &amp; time</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </label>
          ) : null}
        </section>

        {showDropoff ? (
          <section className={`card new-errand-estimate${zoneError ? " warn" : ""}`}>
            {estimateLoading ? (
              <p className="muted" style={{ margin: 0 }}>
                Estimating price…
              </p>
            ) : zoneError ? (
              <p className="error" style={{ margin: 0 }}>
                {zoneError}
              </p>
            ) : estimatePrice ? (
              <>
                <p className="muted" style={{ margin: 0 }}>
                  Estimated price
                </p>
                <p className="new-errand-estimate-price">{estimatePrice}</p>
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                  {estimate!.estimate.distance_km.toFixed(1)} km · ~{estimate!.estimate.duration_min}{" "}
                  min
                  {estimate!.service_zone?.zone_name
                    ? ` · ${estimate!.service_zone.zone_name}`
                    : ""}
                </p>
              </>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Select pickup and drop-off to see an estimate.
              </p>
            )}
          </section>
        ) : null}

        {formError ? <p className="error">{formError}</p> : null}

        <button
          type="submit"
          className="btn-primary"
          disabled={create.isPending || Boolean(zoneError)}
        >
          {create.isPending ? "Creating…" : "Create errand"}
        </button>
      </form>

      {picker ? (
        <LocationPickerModal
          title={picker === "pickup" ? pickupLabel(category) : dropoffLabel(category)}
          onClose={() => setPicker(null)}
          onSelect={(point) => {
            if (picker === "pickup") setPickup(point);
            else setDropoff(point);
            setPicker(null);
          }}
        />
      ) : null}

      {created ? (
        <ErrandCreatedModal
          result={created}
          onContinue={() => navigate(`/errands/${created.errand.id}`, { replace: true })}
        />
      ) : null}
    </div>
  );
}
