import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationDetailModal } from "../components/NotificationDetailModal";
import { NotificationItem } from "../components/NotificationItem";
import {
  useNotificationMutations,
  useNotificationsInfiniteQuery,
} from "../lib/queries";
import type { AppNotification } from "../types/notification";
import { relatedErrandId, relatedSupportTicketId } from "../types/notification";

function NotificationSkeletonList({ count = 6 }: { count?: number }) {
  return (
    <ul className="notification-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <div className="notification-row skeleton-row">
            <span className="skeleton skeleton-avatar" />
            <span className="notification-body">
              <span className="skeleton skeleton-line skeleton-line-short" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line skeleton-line-mid" />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function relatedAction(n: AppNotification): { path: string; label: string } | null {
  const ticketId = relatedSupportTicketId(n);
  if (ticketId) {
    return { path: `/profile/help/tickets/${ticketId}`, label: "View ticket" };
  }
  const errandId = relatedErrandId(n);
  if (errandId) {
    return { path: `/errands/${errandId}`, label: "View errand" };
  }
  return null;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const {
    data,
    error,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useNotificationsInfiniteQuery();
  const { markRead, markAllRead, remove } = useNotificationMutations();
  const [selected, setSelected] = useState<AppNotification | null>(null);

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const lastMeta = data?.pages[data.pages.length - 1]?.meta;
  const total = lastMeta?.total ?? items.length;
  const page = lastMeta?.current_page ?? 1;
  const lastPage = lastMeta?.last_page ?? 1;
  const unread = items.filter((n) => !n.is_read).length;
  const showSkeleton = isPending && items.length === 0;
  const errorMessage =
    error instanceof Error ? error.message : error ? "Failed to load notifications" : null;

  // Keep modal content in sync after mark-as-read cache update
  const selectedLive =
    selected == null ? null : (items.find((n) => n.id === selected.id) ?? selected);

  async function handleOpen(n: AppNotification) {
    setSelected(n);
    if (!n.is_read) {
      try {
        await markRead.mutateAsync(n.id);
      } catch {
        // still show modal even if mark-read fails
      }
    }
  }

  async function handleDelete(id: number) {
    if (selected?.id === id) setSelected(null);
    try {
      await remove.mutateAsync(id);
    } catch {
      // ignore
    }
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Notifications</h1>
          {showSkeleton ? (
            <p className="muted">Loading…</p>
          ) : unread > 0 ? (
            <p className="muted">
              {unread} unread{total > 0 ? ` · ${total} total` : ""}
            </p>
          ) : (
            <p className="muted">
              {total > 0
                ? `${total} notification${total === 1 ? "" : "s"}`
                : "Updates about your errands and account"}
            </p>
          )}
        </div>
        {!showSkeleton && unread > 0 ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void markAllRead.mutateAsync()}
            disabled={markAllRead.isPending}
          >
            {markAllRead.isPending ? "Marking…" : "Mark all read"}
          </button>
        ) : null}
      </div>

      {showSkeleton ? <NotificationSkeletonList /> : null}

      {errorMessage ? <p className="error">{errorMessage}</p> : null}

      {!showSkeleton && !errorMessage && items.length === 0 ? (
        <div className="card empty-notifications">
          <div className="empty-notifications-icon" aria-hidden="true">
            🔔
          </div>
          <h2>No notifications yet</h2>
          <p className="muted">
            When runners respond to your errands or there are account updates, they&apos;ll show up
            here.
          </p>
        </div>
      ) : null}

      {!showSkeleton && items.length > 0 ? (
        <>
          <ul className="notification-list">
            {items.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onOpen={(item) => void handleOpen(item)}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}
          </ul>

          {hasNextPage ? (
            <div className="load-more-wrap">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
              <p className="muted load-more-meta">
                Page {page} of {lastPage}
              </p>
            </div>
          ) : null}

          {isFetchingNextPage ? <NotificationSkeletonList count={3} /> : null}
        </>
      ) : null}

      {selectedLive ? (
        <NotificationDetailModal
          notification={selectedLive}
          onClose={() => setSelected(null)}
          onViewRelated={
            relatedAction(selectedLive)
              ? () => {
                  const action = relatedAction(selectedLive);
                  setSelected(null);
                  if (action) navigate(action.path);
                }
              : undefined
          }
          relatedLabel={relatedAction(selectedLive)?.label ?? "View errand"}
        />
      ) : null}
    </div>
  );
}
