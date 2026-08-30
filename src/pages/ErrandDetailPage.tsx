import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AcceptOfferPaymentModal } from "../components/AcceptOfferPaymentModal";
import { CancelErrandModal } from "../components/CancelErrandModal";
import {
  ErrandTrackingMap,
  type LiveRunnerPosition,
} from "../components/ErrandTrackingMap";
import { RaiseDisputeModal } from "../components/RaiseDisputeModal";
import { RejectProofModal } from "../components/RejectProofModal";
import { ReviewRunnerModal } from "../components/ReviewRunnerModal";
import { useToast } from "../components/ToastProvider";
import { formatDateTime } from "../lib/datetime";
import { formatErrandCode } from "../lib/publicId";
import { createOrGetChatThread } from "../lib/errandApi";
import { getApiErrorMessage } from "../lib/http";
import {
  useAcceptErrandCompletionMutation,
  useAcceptOfferMutation,
  useCancelErrandMutation,
  useErrandOffersQuery,
  useErrandQuery,
  useRaiseErrandDisputeMutation,
  useRejectErrandCompletionMutation,
  useSubmitErrandReviewMutation,
  useVerifyWalletFundingMutation,
} from "../lib/queries";
import { useErrandRealtime } from "../lib/useErrandRealtime";
import {
  canActOnProof,
  canCancelErrand,
  canRaiseDispute,
  canReviewRunner,
  disputeStatusLabel,
  disputeTypeLabel,
  errandStatusLabel,
  errandStatusTone,
  errandDisplayAmount,
  formatNaira,
  proofStatusLabel,
  runnerDisplayName,
  type ErrandDisputeType,
  type ErrandOffer,
} from "../types/errand";
import { isTrackableErrandStatus } from "../types/tracking";

const TIMELINE: { key: string; label: string; match: string[] }[] = [
  { key: "searching", label: "Searching", match: ["draft", "searching", "pending"] },
  { key: "accepted", label: "Accepted", match: ["accepted"] },
  { key: "on_my_way", label: "En route", match: ["on_my_way"] },
  { key: "arrived", label: "Arrived", match: ["arrived"] },
  { key: "in_progress", label: "In progress", match: ["in_progress", "delayed", "waiting_for_buyer"] },
  { key: "completed", label: "Completed", match: ["completed", "delivered"] },
];

function timelineIndex(status: string): number {
  const s = status.toLowerCase();
  if (s.startsWith("cancelled") || s === "failed" || s === "disputed") return -1;
  const idx = TIMELINE.findIndex((step) => step.match.includes(s));
  return idx >= 0 ? idx : 0;
}

export function ErrandDetailPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { errandId: rawId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const errandId = rawId ? Number(rawId) : null;
  const validId = errandId != null && !Number.isNaN(errandId) && errandId > 0 ? errandId : null;

  const [runnerLivePos, setRunnerLivePos] = useState<LiveRunnerPosition | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [payingOffer, setPayingOffer] = useState<ErrandOffer | null>(null);
  const payReturnRef = useRef(false);

  const onRunnerLocation = useCallback(
    (payload: { latitude?: number; longitude?: number; updated_at?: string }) => {
      if (payload.latitude == null || payload.longitude == null) return;
      setRunnerLivePos({
        lat: payload.latitude,
        lng: payload.longitude,
        updatedAt: payload.updated_at ?? new Date().toISOString(),
      });
    },
    [],
  );

  const { live: errandLive } = useErrandRealtime(validId, {
    listenOffers: true,
    listenRunnerLocation: true,
    onRunnerLocation,
  });

  const { data: errand, error, isPending, refetch } = useErrandQuery(validId, {
    // Reverb drives updates; keep a slow backup poll in case a broadcast is missed.
    refetchInterval: errandLive ? 30_000 : 8_000,
  });
  const showOffers =
    !!errand &&
    ["searching", "pending"].includes(errand.status.toLowerCase()) &&
    !errand.runner_id;
  const showTracking = !!errand && isTrackableErrandStatus(errand.status);
  const { data: offers = [] } = useErrandOffersQuery(validId, showOffers, {
    refetchInterval: showOffers ? (errandLive ? 30_000 : 12_000) : false,
  });
  const cancelMutation = useCancelErrandMutation();
  const disputeMutation = useRaiseErrandDisputeMutation(validId ?? 0);
  const acceptMutation = useAcceptOfferMutation(validId ?? 0);
  const verifyFunding = useVerifyWalletFundingMutation();
  const acceptProof = useAcceptErrandCompletionMutation(validId ?? 0);
  const rejectProof = useRejectErrandCompletionMutation(validId ?? 0);
  const submitReview = useSubmitErrandReviewMutation(validId ?? 0);

  useEffect(() => {
    setRunnerLivePos(null);
  }, [validId]);

  useEffect(() => {
    const reference =
      searchParams.get("reference")?.trim() || searchParams.get("trxref")?.trim() || "";
    const payOfferId = Number(searchParams.get("pay_offer"));
    if (
      !validId ||
      !reference ||
      !Number.isFinite(payOfferId) ||
      payOfferId <= 0 ||
      payReturnRef.current
    ) {
      return;
    }
    payReturnRef.current = true;

    void (async () => {
      toast.info("Confirming payment…");
      try {
        const data = await verifyFunding.mutateAsync(reference);
        if (String(data.transaction.status).toLowerCase() !== "completed") {
          toast.info("Payment is still pending. Use Accept & pay again in a moment.");
          return;
        }
        await acceptMutation.mutateAsync(payOfferId);
        toast.success("Offer accepted. Payment is held in escrow.");
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Could not complete payment."));
      } finally {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("reference");
            next.delete("trxref");
            next.delete("pay_offer");
            return next;
          },
          { replace: true },
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for Paystack return
  }, [validId]);

  const backQuery = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("reference");
    next.delete("trxref");
    next.delete("pay_offer");
    const s = next.toString();
    return s ? `?${s}` : "";
  }, [searchParams]);
  const tone = errand ? errandStatusTone(errand.status) : "muted";
  const activeStep = errand ? timelineIndex(errand.status) : 0;
  const cancelled = errand
    ? errand.status.toLowerCase().startsWith("cancelled") ||
      errand.status.toLowerCase() === "failed"
    : false;

  async function confirmCancel() {
    if (!validId || !errand) return;
    try {
      await cancelMutation.mutateAsync(validId);
      setCancelOpen(false);
      toast.success("Errand cancelled.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not cancel errand."));
      setCancelOpen(false);
    }
  }

  async function confirmDispute(payload: { type: ErrandDisputeType; reason: string }) {
    if (!validId) return;
    try {
      await disputeMutation.mutateAsync(payload);
      setDisputeOpen(false);
      toast.success("Dispute submitted. Support will review it.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not raise dispute."));
    }
  }

  async function handleAccept(offer: ErrandOffer) {
    setPayingOffer(offer);
  }

  async function handleChat() {
    if (!errand?.runner?.id) return;
    setChatLoading(true);
    try {
      const res = await createOrGetChatThread(errand.runner.id, errand.id);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Could not open chat");
      }
      navigate(`/chats/${res.data.id}`, {
        state: {
          peerName: res.data.peer.name,
          peerId: res.data.peer.id,
          isOnline: res.data.peer.is_online,
          peerProfilePicture: res.data.peer.profile_picture,
          errandId: errand.id,
        },
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not open chat."));
    } finally {
      setChatLoading(false);
    }
  }

  async function handleAcceptProof() {
    if (!validId) return;
    try {
      await acceptProof.mutateAsync();
      toast.success("Proof accepted. Escrow will be released if it was held.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not accept proof."));
    }
  }

  async function handleRejectProof(reason: string) {
    if (!validId) return;
    try {
      await rejectProof.mutateAsync(reason);
      setRejectOpen(false);
      toast.success("Proof rejected. The runner can resubmit.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not reject proof."));
    }
  }

  async function handleSubmitReview(payload: { rating: number; comment?: string | null }) {
    if (!validId) return;
    try {
      await submitReview.mutateAsync(payload);
      setReviewOpen(false);
      toast.success("Thanks — your review was submitted.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not submit review."));
    }
  }

  if (!validId) {
    return (
      <div className="page">
        <p className="error">Invalid errand.</p>
        <Link to={`/errands${backQuery}`}>← Back to errands</Link>
      </div>
    );
  }

  if (isPending && !errand) {
    return (
      <div className="page errand-detail">
        <Link to={`/errands${backQuery}`} className="profile-back">
          ← Back
        </Link>
        <p className="muted">Loading errand…</p>
      </div>
    );
  }

  if (error || !errand) {
    const message =
      error instanceof Error ? error.message : "Could not load this errand.";
    return (
      <div className="page errand-detail">
        <Link to={`/errands${backQuery}`} className="profile-back">
          ← Back
        </Link>
        <p className="error">
          {message}{" "}
          <button type="button" className="linkish" onClick={() => void refetch()}>
            Retry
          </button>
        </p>
      </div>
    );
  }

  const runnerName = runnerDisplayName(errand.runner);
  const pendingOffers = offers.filter((o) => o.status === "pending");
  const displayAmount = errandDisplayAmount(errand);

  return (
    <div className="page errand-detail">
      <Link to={`/errands${backQuery}`} className="profile-back">
        ← Back
      </Link>

      <header className="errand-detail-header">
        <div>
          <h1>{errand.title || "Untitled errand"}</h1>
          <p className="muted">
            {formatErrandCode(errand.id)}
            {errand.created_at ? ` · ${formatDateTime(errand.created_at)}` : ""}
          </p>
        </div>
        <span className={`errand-status tone-${tone}`}>{errandStatusLabel(errand.status)}</span>
      </header>

      {errand.dispute ? (
        <section className="card stack dispute-banner">
          <h2 className="profile-card-title">Dispute · {disputeStatusLabel(errand.dispute.status)}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {disputeTypeLabel(errand.dispute.type)}
          </p>
          <p style={{ margin: 0 }}>{errand.dispute.reason}</p>
          {errand.dispute.resolution ? (
            <p className="dispute-resolution">
              <strong>Support:</strong> {errand.dispute.resolution}
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Support is reviewing this. Chat with the runner is still available.
            </p>
          )}
        </section>
      ) : null}

      {errand.description ? (
        <section className="card stack">
          <h2 className="profile-card-title">Description</h2>
          <p>{errand.description}</p>
        </section>
      ) : null}

      {typeof errand.metadata?.instructions === "string" &&
      errand.metadata.instructions.trim() ? (
        <section className="card stack">
          <h2 className="profile-card-title">Instructions</h2>
          <p>{String(errand.metadata.instructions)}</p>
        </section>
      ) : null}

      {errand.attachments && errand.attachments.length > 0 ? (
        <section className="card stack">
          <h2 className="profile-card-title">Attachments</h2>
          <div className="errand-attachments-grid">
            {errand.attachments.map((att) => {
              const url = att.file_url;
              if (!url) return null;
              const name = att.file_name || "Attachment";
              const isImage = (att.file_type || "").startsWith("image/");
              return (
                <a
                  key={att.id}
                  className="errand-attachment-card"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {isImage ? (
                    <img src={url} alt={name} />
                  ) : (
                    <span className="errand-attachment-file">
                      {(att.file_type || "").startsWith("audio/") ? "Audio" : "File"}
                    </span>
                  )}
                  <span className="errand-attachment-name muted">{name}</span>
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="card stack">
        <h2 className="profile-card-title">Locations</h2>
        <div className="errand-kv">
          <span className="muted">Pickup</span>
          <span>{errand.pickup_address || "—"}</span>
        </div>
        <div className="errand-kv">
          <span className="muted">Drop-off</span>
          <span>{errand.dropoff_address || "—"}</span>
        </div>
        {errand.category ? (
          <div className="errand-kv">
            <span className="muted">Category</span>
            <span>{errand.category.replace(/_/g, " ")}</span>
          </div>
        ) : null}
        {errand.estimated_distance_km != null ? (
          <div className="errand-kv">
            <span className="muted">Distance</span>
            <span>{Number(errand.estimated_distance_km).toFixed(1)} km</span>
          </div>
        ) : null}
      </section>

      {showTracking ? (
        <ErrandTrackingMap
          key={errand.id}
          errandId={errand.id}
          runnerPos={runnerLivePos}
          live={errandLive}
        />
      ) : null}

      <section className="card stack">
        <h2 className="profile-card-title">Status</h2>
        {cancelled ? (
          <p className="error">{errandStatusLabel(errand.status)}</p>
        ) : (
          <ol className="errand-timeline">
            {TIMELINE.map((step, i) => {
              const done = i <= activeStep;
              const current = i === activeStep;
              return (
                <li
                  key={step.key}
                  className={`errand-timeline-step${done ? " done" : ""}${current ? " current" : ""}`}
                >
                  <span className="errand-timeline-dot" aria-hidden />
                  <span>{step.label}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {(errand.runner || errand.payment || displayAmount != null) && (
        <section className="card stack">
          <h2 className="profile-card-title">Runner</h2>
          {errand.runner ? (
            <>
              <div className="errand-runner-row">
                <div className="errand-runner-person">
                  <span className="errand-runner-avatar" aria-hidden>
                    {errand.runner.profile_picture ? (
                      <img src={errand.runner.profile_picture} alt="" />
                    ) : (
                      <span>{(runnerName.trim()[0] || "R").toUpperCase()}</span>
                    )}
                  </span>
                  <div className="errand-runner-meta">
                    <span className="errand-runner-name">{runnerName}</span>
                    {errand.runner.transport_mode ? (
                      <span className="muted">{errand.runner.transport_mode}</span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="errand-runner-chat"
                  onClick={() => void handleChat()}
                  disabled={chatLoading}
                  aria-label={chatLoading ? "Opening chat" : "Message runner"}
                  title="Message runner"
                >
                  {chatLoading ? (
                    <span aria-hidden>…</span>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7A2.5 2.5 0 0117.5 16H9l-4 3.5V6.5z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">No runner assigned yet.</p>
          )}
          {displayAmount != null ? (
            <div className="errand-kv">
              <span className="muted">Amount</span>
              <span>{formatNaira(displayAmount)}</span>
            </div>
          ) : null}
          {errand.payment ? (
            <div className="errand-kv">
              <span className="muted">Payment</span>
              <span className={`errand-payment-status status-${errand.payment.status.toLowerCase()}`}>
                {errand.payment.status.replace(/_/g, " ")}
              </span>
            </div>
          ) : null}
        </section>
      )}

      {showOffers ? (
        <section className="card stack">
          <h2 className="profile-card-title">Offers</h2>
          {pendingOffers.length === 0 ? (
            <p className="muted">No offers yet. Runners nearby can bid on this errand.</p>
          ) : (
            pendingOffers.map((offer) => (
              <div key={offer.id} className="errand-offer">
                <div>
                  <strong>{runnerDisplayName(offer.runner)}</strong>
                  <p className="muted">{formatNaira(offer.amount)}</p>
                  {offer.message ? <p>{offer.message}</p> : null}
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={acceptMutation.isPending || payingOffer != null}
                  onClick={() => void handleAccept(offer)}
                >
                  {acceptMutation.isPending && payingOffer?.id === offer.id ? "Paying…" : "Accept & pay"}
                </button>
              </div>
            ))
          )}
        </section>
      ) : null}

      {errand.proof ? (
        <section className="card stack">
          <h2 className="profile-card-title">Proof of delivery</h2>
          <div className="errand-kv">
            <span className="muted">Status</span>
            <span>{proofStatusLabel(errand.proof.status)}</span>
          </div>
          {errand.proof.notes ? <p>{errand.proof.notes}</p> : null}
          {errand.proof.rejection_reason ? (
            <p className="error" style={{ margin: 0 }}>
              Rejection reason: {errand.proof.rejection_reason}
            </p>
          ) : null}
          {canActOnProof(errand) &&
          (errand.proof.status || "").toLowerCase() === "rejected" ? (
            <p className="muted" style={{ margin: 0 }}>
              You can still accept this completion or reject it again.
            </p>
          ) : null}
          {errand.proof.proof_photos?.length ? (
            <div className="errand-proof-grid">
              {errand.proof.proof_photos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt="Delivery proof" />
                </a>
              ))}
            </div>
          ) : (
            <p className="muted">No photos attached.</p>
          )}
          {canActOnProof(errand) ? (
            <div className="errand-proof-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={acceptProof.isPending || rejectProof.isPending}
                onClick={() => setRejectOpen(true)}
              >
                {(errand.proof.status || "").toLowerCase() === "rejected"
                  ? "Reject again"
                  : "Reject"}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={acceptProof.isPending || rejectProof.isPending}
                onClick={() => void handleAcceptProof()}
              >
                {acceptProof.isPending ? "Accepting…" : "Accept completion"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {errand.status.toLowerCase() === "completed" ? (
        <section className="card stack">
          <h2 className="profile-card-title">Review</h2>
          {errand.buyer_has_reviewed ? (
            <p className="muted" style={{ margin: 0 }}>
              You already reviewed {runnerName || "this runner"}.
            </p>
          ) : canReviewRunner(errand) ? (
            <>
              <p className="muted" style={{ margin: 0 }}>
                Rate {runnerName || "your runner"} after checking the delivery proof.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setReviewOpen(true)}
                disabled={submitReview.isPending}
              >
                Write review
              </button>
            </>
          ) : null}
        </section>
      ) : null}

      {canCancelErrand(errand.status) || canRaiseDispute(errand) ? (
        <div className="errand-detail-actions">
          {canRaiseDispute(errand) ? (
            <button
              type="button"
              className="btn-ghost profile-danger-btn"
              disabled={disputeMutation.isPending}
              onClick={() => setDisputeOpen(true)}
            >
              Raise a dispute
            </button>
          ) : null}
          {canCancelErrand(errand.status) ? (
            <button
              type="button"
              className="btn-ghost profile-danger-btn"
              disabled={cancelMutation.isPending}
              onClick={() => setCancelOpen(true)}
            >
              Cancel errand
            </button>
          ) : null}
        </div>
      ) : null}

      {cancelOpen ? (
        <CancelErrandModal
          errandTitle={errand.title || "this errand"}
          escrowHeld={errand.payment?.escrow?.status === "held"}
          busy={cancelMutation.isPending}
          onClose={() => setCancelOpen(false)}
          onConfirm={() => void confirmCancel()}
        />
      ) : null}

      {payingOffer && validId ? (
        <AcceptOfferPaymentModal
          errandId={validId}
          offer={payingOffer}
          onClose={() => setPayingOffer(null)}
          onPaid={() => setPayingOffer(null)}
        />
      ) : null}

      {disputeOpen ? (
        <RaiseDisputeModal
          errandTitle={errand.title || "this errand"}
          busy={disputeMutation.isPending}
          onClose={() => !disputeMutation.isPending && setDisputeOpen(false)}
          onConfirm={(payload) => void confirmDispute(payload)}
        />
      ) : null}

      {rejectOpen ? (
        <RejectProofModal
          busy={rejectProof.isPending}
          onClose={() => !rejectProof.isPending && setRejectOpen(false)}
          onConfirm={(reason) => void handleRejectProof(reason)}
        />
      ) : null}

      {reviewOpen ? (
        <ReviewRunnerModal
          runnerName={runnerName}
          busy={submitReview.isPending}
          onClose={() => !submitReview.isPending && setReviewOpen(false)}
          onConfirm={(payload) => void handleSubmitReview(payload)}
        />
      ) : null}
    </div>
  );
}
