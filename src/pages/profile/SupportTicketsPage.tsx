import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { formatDateTime } from "../../lib/datetime";
import { useSupportTicketsInfiniteQuery } from "../../lib/queries";
import emptyTicketsIllustration from "../../assets/empty-state-support-ticket.png";
import {
  SUPPORT_TICKET_STATUS_FILTERS,
  supportTicketCategoryLabel,
  supportTicketStatusLabel,
  unreadCountLabel,
  type SupportTicketStatus,
} from "../../types/supportTicket";

type StatusFilter = "all" | SupportTicketStatus;

export function SupportTicketsPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const { data, isPending, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSupportTicketsInfiniteQuery(status);
  const tickets = useMemo(() => data?.pages.flatMap((page) => page.tickets) ?? [], [data]);
  const errorMessage = error instanceof Error ? error.message : error ? "Failed to load tickets" : null;
  const showEmptyAll = !isPending && !errorMessage && tickets.length === 0 && status === "all";
  const showEmptyFilter = !isPending && !errorMessage && tickets.length === 0 && status !== "all";

  return (
    <div className="page profile-page">
      <ProfileSubHeader
        title="Support tickets"
        backTo="/profile/help"
        action={
          <Link to="/profile/help/tickets/new" className="btn-primary">
            New ticket
          </Link>
        }
      />

      <div className="errands-tabs ticket-status-tabs" role="tablist" aria-label="Ticket status">
        {SUPPORT_TICKET_STATUS_FILTERS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            className={`errands-tab${status === tab.value ? " active" : ""}`}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isPending && tickets.length === 0 ? <p className="muted">Loading…</p> : null}
      {errorMessage ? <p className="error">{errorMessage}</p> : null}

      {showEmptyAll ? (
        <div className="card ticket-empty">
          <img
            src={emptyTicketsIllustration}
            alt=""
            className="ticket-empty-art"
            width={320}
            height={240}
          />
          <h2>No tickets yet</h2>
          <p className="muted">
            Need help with your account, a payment, or KYC? Open a ticket and our team will get back
            to you.
          </p>
          <Link to="/profile/help/tickets/new" className="btn-primary">
            Open a ticket
          </Link>
        </div>
      ) : null}

      {showEmptyFilter ? (
        <p className="muted">No tickets with this status.</p>
      ) : null}

      {tickets.length > 0 ? (
        <>
          <nav className="card profile-menu" aria-label="My tickets">
            {tickets.map((ticket) => {
              const unreadLabel = unreadCountLabel(ticket.unread_count ?? 0);
              return (
                <Link
                  key={ticket.id}
                  to={`/profile/help/tickets/${ticket.id}`}
                  className="profile-menu-item"
                  aria-label={
                    unreadLabel
                      ? `${ticket.subject}, ${unreadLabel} unread ${ticket.unread_count === 1 ? "reply" : "replies"}`
                      : undefined
                  }
                >
                  <span className="profile-menu-text">
                    <span className="profile-menu-title">{ticket.subject}</span>
                    <span className="profile-menu-sub">
                      {ticket.public_id} · {supportTicketCategoryLabel(ticket.category)} ·{" "}
                      {supportTicketStatusLabel(ticket.status)}
                      {ticket.preview ? ` · ${ticket.preview}` : ""}
                    </span>
                    <span className="ticket-list-meta muted">
                      {formatDateTime(ticket.last_replied_at ?? ticket.created_at)}
                    </span>
                  </span>
                  {unreadLabel ? (
                    <span className="profile-menu-count" aria-hidden>
                      {unreadLabel}
                    </span>
                  ) : null}
                  <span className="profile-menu-chevron" aria-hidden>
                    ›
                  </span>
                </Link>
              );
            })}
          </nav>
          {hasNextPage ? (
            <div className="chat-load-more">
              <button
                type="button"
                className="btn-secondary"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
