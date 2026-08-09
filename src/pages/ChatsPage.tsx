import { useMemo, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { ChatArchivesMenu } from "../components/ChatArchivesMenu";
import { fetchChatMessages, MESSAGES_PAGE_SIZE } from "../lib/chatApi";
import { formatRelativeWhen } from "../lib/datetime";
import { queryClient, queryKeys } from "../lib/queryClient";
import { useChatThreadsQuery } from "../lib/queries";
import type { ChatThread } from "../types/chat";

function PeerAvatar({
  name,
  picture,
  online,
}: {
  name: string;
  picture: string | null;
  online: boolean;
}) {
  const initial = (name.trim()[0] || "?").toUpperCase();
  return (
    <span className={`chat-avatar${online ? " online" : ""}`}>
      {picture ? (
        <img src={picture} alt="" className="chat-avatar-img" />
      ) : (
        <span className="chat-avatar-fallback">{initial}</span>
      )}
      {online ? <span className="chat-online-dot" aria-label="Online" /> : null}
    </span>
  );
}

function ChatListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="chat-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <div className="chat-row skeleton-row">
            <span className="skeleton skeleton-avatar chat-skeleton-avatar" />
            <span className="chat-row-body">
              <span className="skeleton skeleton-line skeleton-line-short" />
              <span className="skeleton skeleton-line skeleton-line-mid" />
            </span>
            <span className="skeleton skeleton-line" style={{ width: 36, height: 12 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ChatsPage() {
  const navigate = useNavigate();
  const { threadId } = useParams();
  const selectedId = threadId ? Number(threadId) : null;
  const hasThread = selectedId != null && !Number.isNaN(selectedId);

  const {
    data: threads = [],
    error,
    isPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useChatThreadsQuery();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.peer.name.toLowerCase().includes(q) ||
        (t.last_message ?? "").toLowerCase().includes(q),
    );
  }, [threads, query]);

  const showSkeleton = isPending && threads.length === 0;
  const errorMessage =
    error instanceof Error ? error.message : error ? "Failed to load chats" : null;

  function openThread(thread: ChatThread) {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.chatMessages(thread.id),
      staleTime: 5 * 60 * 1000,
      queryFn: async () => {
        const res = await fetchChatMessages(thread.id, { limit: MESSAGES_PAGE_SIZE });
        if (!res.success || !res.data) {
          throw new Error(res.error?.message ?? "Failed to load messages");
        }
        return res.data;
      },
    });
    navigate(`/chats/${thread.id}`, {
      state: {
        peerName: thread.peer.name,
        peerId: thread.peer.id,
        isOnline: thread.peer.is_online,
        peerProfilePicture: thread.peer.profile_picture,
        errandId: thread.errand_id,
      },
    });
  }

  return (
    <div className={`chats-split${hasThread ? " has-thread" : ""}`}>
      <aside className="chats-list-panel">
        <div className="chats-list-toolbar">
          <label className="chat-search">
            <span className="chat-search-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M16.5 16.5L21 21"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="sr-only">Search chats</span>
            <input
              type="search"
              placeholder="Search here..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <ChatArchivesMenu />
        </div>

        <div className="chats-list-scroll">
          {showSkeleton ? <ChatListSkeleton /> : null}

          {errorMessage ? <p className="error">{errorMessage}</p> : null}

          {!showSkeleton && !errorMessage && threads.length === 0 ? (
            <div className="chats-panel-empty">
              <div className="empty-notifications-icon" aria-hidden="true">
                💬
              </div>
              <h2>No chats yet</h2>
              <p className="muted">
                When you connect with a runner on an errand, your conversation will show up here.
              </p>
            </div>
          ) : null}

          {!showSkeleton && threads.length > 0 && filtered.length === 0 ? (
            <div className="chats-panel-empty">
              <h2>No matches</h2>
              <p className="muted">Try a different name or message keyword.</p>
            </div>
          ) : null}

          {!showSkeleton && filtered.length > 0 ? (
            <>
              <ul className="chat-list">
                {filtered.map((thread) => {
                  const unread = thread.unread_count > 0;
                  const selected = selectedId === thread.id;
                  const preview = thread.last_message?.trim() || "No messages yet";
                  const unreadLabel =
                    thread.unread_count > 99
                      ? "99+"
                      : thread.unread_count > 0
                        ? String(thread.unread_count)
                        : null;

                  return (
                    <li key={thread.id}>
                      <div
                        className={`chat-row${unread ? " unread" : ""}${selected ? " selected" : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-current={selected ? "true" : undefined}
                        onClick={() => openThread(thread)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openThread(thread);
                          }
                        }}
                      >
                        <PeerAvatar
                          name={thread.peer.name}
                          picture={thread.peer.profile_picture}
                          online={thread.peer.is_online}
                        />
                        <span className="chat-row-body">
                          <span className="chat-peer-name">{thread.peer.name}</span>
                          <span className="chat-preview">{preview}</span>
                        </span>
                        <span className="chat-meta">
                          <span className="chat-time">
                            {formatRelativeWhen(thread.last_message_at)}
                          </span>
                          {unreadLabel ? (
                            <span className="chat-unread-count">{unreadLabel}</span>
                          ) : null}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {hasNextPage && !query.trim() ? (
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
      </aside>

      <section className="chats-thread-panel">
        <Outlet />
      </section>
    </div>
  );
}

export function ChatSelectEmpty() {
  return (
    <div className="chats-thread-empty">
      <div className="empty-notifications-icon" aria-hidden="true">
        💬
      </div>
      <h2>Select a chat</h2>
      <p className="muted">Choose a conversation from the list to view messages.</p>
    </div>
  );
}
