import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { useToast } from "../../components/ToastProvider";
import { formatDateTime } from "../../lib/datetime";
import { getApiErrorMessage } from "../../lib/http";
import { formatErrandCode } from "../../lib/publicId";
import { useReplySupportTicketMutation, useSupportTicketQuery } from "../../lib/queries";
import {
  supportTicketCategoryLabel,
  supportTicketStatusLabel,
} from "../../types/supportTicket";

export function SupportTicketThreadPage() {
  const { ticketId } = useParams();
  const id = Number(ticketId);
  const toast = useToast();
  const { data: ticket, isPending, error } = useSupportTicketQuery(Number.isFinite(id) ? id : null);
  const reply = useReplySupportTicketMutation(id);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  const messages = ticket?.messages ?? [];
  const errorMessage = error instanceof Error ? error.message : error ? "Failed to load ticket" : null;

  useEffect(() => {
    prevLenRef.current = 0;
  }, [ticket?.id]);

  useEffect(() => {
    const next = messages.length;
    if (next > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({
        behavior: prevLenRef.current === 0 ? "auto" : "smooth",
        block: "end",
      });
    }
    prevLenRef.current = next;
  }, [messages.length, ticket?.id]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!ticket?.can_reply) return;
    if (!message.trim() && !attachment) {
      toast.error("Write a message or attach an image.");
      return;
    }
    try {
      await reply.mutateAsync({
        message: message.trim() || "Image",
        attachment,
      });
      setMessage("");
      setAttachment(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to send reply."));
    }
  }

  return (
    <div className="page profile-page">
      <ProfileSubHeader title={ticket?.subject || "Ticket"} backTo="/profile/help/tickets" />

      {isPending && !ticket ? <p className="muted">Loading…</p> : null}
      {errorMessage ? <p className="error">{errorMessage}</p> : null}

      {ticket ? (
        <>
          <p className="muted ticket-thread-meta">
            {ticket.public_id} · {supportTicketCategoryLabel(ticket.category)} ·{" "}
            {supportTicketStatusLabel(ticket.status)}
            {ticket.errand?.id ? (
              <>
                {" "}
                ·{" "}
                <Link to={`/errands/${ticket.errand.id}`}>
                  {ticket.errand.title || formatErrandCode(ticket.errand.id)}
                </Link>
              </>
            ) : null}
          </p>

          <div className="ticket-thread">
            {messages.map((item) => (
              <article
                key={item.id}
                className={`ticket-msg ${item.is_staff ? "staff" : "mine"}`}
              >
                <p className="ticket-msg-meta">
                  <strong>{item.is_staff ? "Support" : "You"}</strong>
                  <span>{formatDateTime(item.created_at)}</span>
                </p>
                <p className="ticket-msg-body">{item.body}</p>
                {item.attachment_url ? (
                  <a href={item.attachment_url} target="_blank" rel="noreferrer">
                    <img src={item.attachment_url} alt="Attachment" className="ticket-msg-image" />
                  </a>
                ) : null}
              </article>
            ))}
            <div ref={bottomRef} />
          </div>

          {ticket.can_reply ? (
            <form className="card stack profile-form" onSubmit={(e) => void handleSend(e)}>
              {attachment ? (
                <p className="muted">
                  Attached: {attachment.name}{" "}
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setAttachment(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    Remove
                  </button>
                </p>
              ) : null}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Write a reply…"
                maxLength={5000}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
              />
              <button type="submit" className="btn-primary" disabled={reply.isPending}>
                {reply.isPending ? "Sending…" : "Send reply"}
              </button>
            </form>
          ) : (
            <p className="chat-ended-notice ticket-locked-notice">
              This ticket is {supportTicketStatusLabel(ticket.status).toLowerCase()}. Messaging is no
              longer available.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
