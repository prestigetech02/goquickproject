import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { useToast } from "../../components/ToastProvider";
import { fetchMyErrands } from "../../lib/errandApi";
import { getApiErrorMessage } from "../../lib/http";
import { formatErrandCode } from "../../lib/publicId";
import { useCreateSupportTicketMutation } from "../../lib/queries";
import {
  SUPPORT_TICKET_CATEGORIES,
  type SupportTicketCategory,
} from "../../types/supportTicket";
import type { Errand } from "../../types/errand";

async function fetchErrandsForTicketPicker(): Promise<Errand[]> {
  const first = await fetchMyErrands({ perPage: 50, page: 1 });
  if (!first.success || !first.data) {
    throw new Error(first.error?.message ?? "Failed to load errands");
  }

  const errands = [...first.data.errands];
  const totalPages = first.data.pagination.total_pages ?? 1;
  if (totalPages > 1) {
    const second = await fetchMyErrands({ perPage: 50, page: 2 });
    if (second.success && second.data) {
      errands.push(...second.data.errands);
    }
  }
  return errands;
}

function TicketErrandPicker({
  errandId,
  onChange,
}: {
  errandId: number | "";
  onChange: (id: number | "") => void;
}) {
  const errandsQuery = useQuery({
    queryKey: ["support-tickets", "errand-picker"],
    queryFn: fetchErrandsForTicketPicker,
    staleTime: 60_000,
  });

  const errands = errandsQuery.data ?? [];

  return (
    <>
      <label htmlFor="ticket-errand">Linked errand (optional)</label>
      <select
        id="ticket-errand"
        value={errandId === "" ? "" : String(errandId)}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
        disabled={errandsQuery.isPending}
      >
        <option value="">
          {errandsQuery.isPending ? "Loading errands…" : "None"}
        </option>
        {errands.map((errand) => (
          <option key={errand.id} value={errand.id}>
            {formatErrandCode(errand.id)}
            {errand.title ? ` · ${errand.title}` : ""}
          </option>
        ))}
      </select>
      {errandsQuery.isError ? (
        <p className="field-hint muted">Could not load your errands. You can still submit without one.</p>
      ) : null}
    </>
  );
}

export function NewSupportTicketPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateSupportTicketMutation();
  const [category, setCategory] = useState<SupportTicketCategory>("account");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errandId, setErrandId] = useState<number | "">("");
  const [attachment, setAttachment] = useState<File | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Subject and message are required.");
      return;
    }

    try {
      const ticket = await create.mutateAsync({
        category,
        subject: subject.trim(),
        message: message.trim(),
        errandId: errandId === "" ? null : errandId,
        attachment,
      });
      toast.success("Ticket submitted.");
      navigate(`/profile/help/tickets/${ticket.id}`, { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to submit ticket."));
    }
  }

  return (
    <div className="page profile-page">
      <ProfileSubHeader title="New ticket" backTo="/profile/help/tickets" />

      <form onSubmit={(e) => void handleSubmit(e)} className="card stack profile-form">
        <label htmlFor="ticket-category">Category</label>
        <select
          id="ticket-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
          required
        >
          {SUPPORT_TICKET_CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <label htmlFor="ticket-subject">Subject</label>
        <input
          id="ticket-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={160}
          required
        />

        <TicketErrandPicker errandId={errandId} onChange={setErrandId} />

        <label htmlFor="ticket-message">Message</label>
        <textarea
          id="ticket-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={5000}
          required
        />

        <label htmlFor="ticket-attachment">Image (optional)</label>
        <input
          id="ticket-attachment"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
        />
        <p className="field-hint muted">JPG, PNG, or WebP. Max 5 MB.</p>

        <button type="submit" className="btn-primary" disabled={create.isPending}>
          {create.isPending ? "Submitting…" : "Submit ticket"}
        </button>
      </form>
    </div>
  );
}
