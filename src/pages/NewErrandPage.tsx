import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ErrandCreatedModal } from "../components/ErrandCreatedModal";
import { LocationPickerModal } from "../components/LocationPickerModal";
import {
  PaymentMethodOptions,
  type ErrandPayMethod,
} from "../components/PaymentMethodOptions";
import { useToast } from "../components/ToastProvider";
import { getStoredUser } from "../lib/auth";
import {
  estimateErrand,
  type CreateErrandResult,
  type ErrandEstimate,
  type ErrandTypeSchema,
} from "../lib/errandApi";
import { getApiErrorMessage } from "../lib/http";
import {
  completePaystackWalletFunding,
  shortfallToFund,
} from "../lib/paystackCheckout";
import {
  useCreateErrandMutation,
  useErrandTypeSchemasQuery,
  useFundWalletMutation,
  useProfileQuery,
  useVerifyWalletFundingMutation,
  useWalletQuery,
} from "../lib/queries";
import type { LocationPoint } from "../lib/placesApi";
import { isProfileComplete } from "../types/api";
import { formatNaira } from "../types/errand";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_ACCEPT_IMAGE = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const ATTACHMENT_ACCEPT_FILE =
  "image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,.jpg,.jpeg,.png,.webp,.pdf,.mp3,.m4a,.aac,.ogg,.wav";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
};

function isAllowedAttachment(file: File) {
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  const allowedMimes = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/ogg",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
  ]);
  const allowedExt = /\.(jpe?g|png|webp|pdf|mp3|m4a|aac|ogg|wav)$/i;
  return allowedMimes.has(mime) || allowedExt.test(name);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

function descriptionPlaceholder(slug: string) {
  switch (slug) {
    case "shopping":
      return "e.g. Buy 2kg rice, 4 tomatoes, and Peak milk from Shoprite";
    case "pickup_drop":
    case "delivery":
      return "e.g. Pick up a small package from Jane at the gate and deliver to my office";
    case "queue":
      return "e.g. Queue at PHCN to pay my electricity bill and collect the receipt";
    default:
      return "e.g. Help me get my laundry from the dry cleaner and bring it home";
  }
}

function parseOfferAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/\s/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
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
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = searchParams.get("type")?.trim() || "custom";

  const schemasQ = useErrandTypeSchemasQuery();
  const create = useCreateErrandMutation();
  const walletQ = useWalletQuery();
  const { data: profile } = useProfileQuery();
  const fundWallet = useFundWalletMutation();
  const verifyFunding = useVerifyWalletFundingMutation();

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
  const [offerAmount, setOfferAmount] = useState("");
  const [created, setCreated] = useState<CreateErrandResult | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [payMethod, setPayMethod] = useState<ErrandPayMethod>("wallet");
  const [paying, setPaying] = useState(false);
  const payMethodInited = useRef(false);
  const fundReturnRef = useRef(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isProfileComplete(getStoredUser())) {
      navigate("/complete-profile", { replace: true, state: { reason: "post_errand" } });
    }
  }, [navigate]);

  useEffect(() => {
    const reference =
      searchParams.get("reference")?.trim() || searchParams.get("trxref")?.trim() || "";
    if (!reference || fundReturnRef.current) return;
    fundReturnRef.current = true;
    void (async () => {
      toast.info("Confirming payment…");
      try {
        const data = await verifyFunding.mutateAsync(reference);
        if (String(data.transaction.status).toLowerCase() === "completed") {
          toast.success("Wallet funded. Create the errand to continue.");
          payMethodInited.current = true;
          setPayMethod("wallet");
        } else {
          toast.info("Payment is still pending. It will update shortly.");
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Could not confirm payment."));
      } finally {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("reference");
            next.delete("trxref");
            return next;
          },
          { replace: true },
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Paystack return URL
  }, []);

  useEffect(() => {
    return () => {
      for (const item of pendingAttachments) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
    // Only revoke on unmount; individual removes revoke their own URLs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addAttachmentFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    const room = MAX_ATTACHMENTS - pendingAttachments.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }

    const next: PendingAttachment[] = [];
    for (const file of incoming.slice(0, room)) {
      if (!isAllowedAttachment(file)) {
        toast.error(`“${file.name}” isn’t an allowed type. Use image, PDF, or audio.`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`“${file.name}” is over 10 MB.`);
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      });
    }

    if (incoming.length > room) {
      toast.error(`Only ${MAX_ATTACHMENTS} attachments allowed. Extra files were skipped.`);
    }
    if (next.length) setPendingAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(id: string) {
    setPendingAttachments((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

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
    const pickupReady =
      pickup &&
      !pickup.resolving &&
      Number.isFinite(pickup.latitude) &&
      Number.isFinite(pickup.longitude);

    const dropoffReady =
      !showDropoff ||
      (dropoff &&
        !dropoff.resolving &&
        Number.isFinite(dropoff.latitude) &&
        Number.isFinite(dropoff.longitude));

    if (!pickupReady || !dropoffReady) {
      setEstimate(null);
      setZoneError(null);
      setEstimateLoading(Boolean(pickup?.resolving || dropoff?.resolving));
      return;
    }

    const dropLat = showDropoff ? dropoff!.latitude : pickup!.latitude;
    const dropLng = showDropoff ? dropoff!.longitude : pickup!.longitude;
    const wait = category === "queue" ? Number(waitMinutes) : null;

    let cancelled = false;
    setEstimateLoading(true);
    setZoneError(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await estimateErrand({
          category,
          pickup_latitude: pickup!.latitude,
          pickup_longitude: pickup!.longitude,
          dropoff_latitude: showDropoff ? dropLat : null,
          dropoff_longitude: showDropoff ? dropLng : null,
          expected_wait_minutes:
            wait != null && Number.isFinite(wait) && wait > 0 ? wait : null,
        });
        if (cancelled) return;
        setEstimateLoading(false);
        if (!res.success || !res.data) {
          if (res.error?.code === "ZONE_NOT_SERVICEABLE") {
            setZoneError(res.error.message ?? "This route is outside our service zones.");
          } else {
            setZoneError(null);
          }
          setEstimate(null);
          return;
        }
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
  }, [pickup, dropoff, category, showDropoff, waitMinutes]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!pickup) {
      toast.error("Choose a pickup location.");
      return;
    }
    if (pickup.resolving || !Number.isFinite(pickup.latitude) || !Number.isFinite(pickup.longitude)) {
      toast.error("Still confirming pickup location…");
      return;
    }
    if (showDropoff && !dropoff) {
      toast.error("Choose a drop-off location.");
      return;
    }
    if (
      showDropoff &&
      dropoff &&
      (dropoff.resolving || !Number.isFinite(dropoff.latitude) || !Number.isFinite(dropoff.longitude))
    ) {
      toast.error("Still confirming drop-off location…");
      return;
    }
    if (zoneError) {
      toast.error(zoneError);
      return;
    }
    if (category === "queue") {
      const mins = Number(waitMinutes);
      if (!Number.isFinite(mins) || mins <= 0) {
        toast.error("Enter expected wait time in minutes.");
        return;
      }
    }
    if (timing === "scheduled" && !scheduledAt) {
      toast.error("Choose a scheduled date and time.");
      return;
    }

    if (!estimate?.suggested_price || zoneError) {
      toast.error(zoneError || "Wait for a price estimate before creating.");
      return;
    }

    const floor = Number(estimate.suggested_price.min);
    const offerRaw = offerAmount.replace(/,/g, "").trim();
    const offer = parseOfferAmount(offerAmount);
    if (offerRaw && offer == null) {
      toast.error("Enter a valid offer amount, or leave it blank to use the platform estimate.");
      return;
    }
    if (offer != null && Number.isFinite(floor) && offer + 0.0001 < floor) {
      toast.error(`Your offer must be at least ${formatNaira(floor)} (platform minimum).`);
      return;
    }

    const required = offer ?? floor;
    const walletBalance = walletQ.data?.balance ?? 0;

    if (payMethod === "wallet") {
      if (walletBalance + 0.0001 < required) {
        toast.error("Insufficient wallet balance. Pay with card / transfer, or fund your wallet first.");
        setPayMethod("card");
        return;
      }
    } else {
      const email = profile?.email?.trim();
      if (!email) {
        toast.error("Add an email to your profile before paying with card or transfer.");
        return;
      }
      const toFund = shortfallToFund(required, walletBalance);
      if (toFund > 0) {
        setPaying(true);
        try {
          toast.info("Opening Paystack…");
          await completePaystackWalletFunding({
            amount: toFund,
            email,
            callbackUrl: `${window.location.origin}/errands/new`,
            fund: (payload) => fundWallet.mutateAsync(payload),
            verify: (reference) => verifyFunding.mutateAsync(reference),
          });
        } catch (err) {
          setPaying(false);
          toast.error(getApiErrorMessage(err, "Payment failed. Your errand was not created."));
          return;
        }
        setPaying(false);
      }
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
        budget_min: offer,
        budget_max: offer,
        pickup_address: pickup.address,
        pickup_latitude: pickup.latitude,
        pickup_longitude: pickup.longitude,
        dropoff_address: showDropoff ? dropoff?.address ?? null : null,
        dropoff_latitude: showDropoff ? dropoff?.latitude ?? null : null,
        dropoff_longitude: showDropoff ? dropoff?.longitude ?? null : null,
        metadata: Object.keys(metadata).length ? metadata : null,
        attachments:
          pendingAttachments.length > 0
            ? pendingAttachments.map((a) => a.file)
            : undefined,
      });
      setCreated(result);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === "INSUFFICIENT_BALANCE") {
        toast.error("Insufficient wallet balance. Pay with card / transfer to fund the amount, then try again.");
        setPayMethod("card");
      } else if (code === "ZONE_NOT_SERVICEABLE") {
        toast.error(getApiErrorMessage(err, "This location is outside our service zones."));
      } else if (code === "OFFER_BELOW_MINIMUM") {
        toast.error(getApiErrorMessage(err, "Your offer is below the platform minimum."));
      } else {
        toast.error(getApiErrorMessage(err, "Could not create errand."));
      }
    }
  }

  const estimatePrice =
    estimate?.suggested_price != null
      ? estimate.suggested_price.min === estimate.suggested_price.max
        ? formatNaira(estimate.suggested_price.min)
        : `${formatNaira(estimate.suggested_price.min)} – ${formatNaira(estimate.suggested_price.max)}`
      : null;

  const offerFloor = estimate?.suggested_price?.min ?? null;
  const offerNum = parseOfferAmount(offerAmount);
  const offerInvalid = offerAmount.replace(/,/g, "").trim().length > 0 && offerNum == null;
  const offerBelowFloor =
    offerFloor != null && offerNum != null && offerNum + 0.0001 < offerFloor;
  const requiredAmount =
    offerBelowFloor || offerInvalid ? null : (offerNum ?? offerFloor);
  const walletBalance = walletQ.data?.balance ?? null;
  const canSubmit =
    !create.isPending &&
    !paying &&
    !zoneError &&
    Boolean(estimate?.suggested_price) &&
    !offerBelowFloor &&
    !offerInvalid;

  useEffect(() => {
    if (payMethodInited.current || walletQ.isPending || requiredAmount == null || walletBalance == null) {
      return;
    }
    payMethodInited.current = true;
    setPayMethod(walletBalance + 0.0001 >= requiredAmount ? "wallet" : "card");
  }, [walletQ.isPending, requiredAmount, walletBalance]);

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
            <strong>
              {pickup?.address || "Choose location"}
              {pickup?.resolving ? "…" : ""}
              {pickup?.isCustom && !pickup.resolving ? " (custom)" : ""}
            </strong>
          </button>
          {showDropoff ? (
            <button
              type="button"
              className="location-field-btn"
              onClick={() => setPicker("dropoff")}
            >
              <span className="muted">{dropoffLabel(category)}</span>
              <strong>
                {dropoff?.address || "Choose location"}
                {dropoff?.resolving ? "…" : ""}
                {dropoff?.isCustom && !dropoff.resolving ? " (custom)" : ""}
              </strong>
            </button>
          ) : null}
        </section>

        <section className="card stack">
          <h2 className="profile-card-title">Details</h2>
          <label>
            <span className="label">Description</span>
            <textarea
              rows={3}
              placeholder={descriptionPlaceholder(category)}
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

          <div className="new-errand-attachments">
            <span className="label">Attachments (optional)</span>
            <p className="muted new-errand-attachments-hint">
              Add a photo, document, or take a picture so the runner has more context.
            </p>

            <input
              ref={galleryInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT_IMAGE}
              multiple
              className="sr-only"
              onChange={(e) => {
                addAttachmentFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                addAttachmentFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT_FILE}
              multiple
              className="sr-only"
              onChange={(e) => {
                addAttachmentFiles(e.target.files);
                e.target.value = "";
              }}
            />

            <div className="new-errand-attach-actions">
              <button
                type="button"
                className="new-errand-attach-btn"
                disabled={pendingAttachments.length >= MAX_ATTACHMENTS}
                onClick={() => galleryInputRef.current?.click()}
              >
                Photo
              </button>
              <button
                type="button"
                className="new-errand-attach-btn"
                disabled={pendingAttachments.length >= MAX_ATTACHMENTS}
                onClick={() => cameraInputRef.current?.click()}
              >
                Camera
              </button>
              <button
                type="button"
                className="new-errand-attach-btn"
                disabled={pendingAttachments.length >= MAX_ATTACHMENTS}
                onClick={() => fileInputRef.current?.click()}
              >
                File
              </button>
            </div>

            {pendingAttachments.length > 0 ? (
              <ul className="new-errand-attach-list">
                {pendingAttachments.map((item) => (
                  <li key={item.id} className="new-errand-attach-item">
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt="" className="new-errand-attach-thumb" />
                    ) : (
                      <span className="new-errand-attach-icon" aria-hidden>
                        {item.file.type.startsWith("audio/") ? "AUD" : "DOC"}
                      </span>
                    )}
                    <div className="new-errand-attach-meta">
                      <span className="new-errand-attach-name">{item.file.name}</span>
                      <span className="muted">{formatFileSize(item.file.size)}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost new-errand-attach-remove"
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() => removeAttachment(item.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

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
                Platform estimate
              </p>
              <p className="new-errand-estimate-price">{estimatePrice}</p>
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                {showDropoff
                  ? `${estimate!.estimate.distance_km.toFixed(1)} km · ~${estimate!.estimate.duration_min} min`
                  : "Based on errand type and location"}
                {estimate!.service_zone?.zone_name &&
                (estimate!.service_zone.source === "pickup_geo_match" ||
                  estimate!.service_zone.source === "dropoff_geo_match")
                  ? ` · ${estimate!.service_zone.zone_name}`
                  : ""}
              </p>

              <label className="new-errand-offer">
                <span className="label">Or set your own price</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="5,000"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                />
              </label>
              {offerBelowFloor ? (
                <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>
                  Minimum offer is {formatNaira(offerFloor!)}.
                </p>
              ) : offerInvalid ? (
                <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>
                  Enter a valid amount, or leave blank to use the platform estimate.
                </p>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                  {offerNum != null
                    ? `You're offering ${formatNaira(offerNum)}.`
                    : `Leave blank to post at the platform estimate ${estimatePrice}.`}
                </p>
              )}
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {showDropoff
                ? "Select pickup and drop-off to see an estimate and set your offer."
                : "Select a location to see an estimate and set your offer."}
            </p>
          )}
        </section>

        {requiredAmount != null ? (
          <section className="card stack">
            <PaymentMethodOptions
              amount={requiredAmount}
              walletBalance={walletBalance}
              walletLoading={walletQ.isPending}
              method={payMethod}
              onChange={setPayMethod}
              disabled={create.isPending || paying}
              hint="Card / transfer opens Paystack for this amount. That credit is used for escrow when you accept a runner."
            />
          </section>
        ) : null}

        <button type="submit" className="btn-primary" disabled={!canSubmit}>
          {paying
            ? "Opening Paystack…"
            : create.isPending
              ? "Creating…"
              : payMethod === "card" &&
                  requiredAmount != null &&
                  shortfallToFund(requiredAmount, walletBalance ?? 0) > 0
                ? `Pay ${formatNaira(requiredAmount)} & create`
                : "Create errand"}
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
          onSelectFailed={(message) => {
            if (picker === "pickup") setPickup(null);
            else setDropoff(null);
            toast.error(message);
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
