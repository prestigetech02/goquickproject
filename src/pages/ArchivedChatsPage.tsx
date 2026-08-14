import { Link, useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchArchivedChatThreads, fetchChatMessages, MESSAGES_PAGE_SIZE } from "../lib/chatApi";
import { formatShortDate } from "../lib/datetime";
import { formatChatCode, formatErrandCode } from "../lib/publicId";
import { http } from "../lib/http";
import { queryClient, queryKeys } from "../lib/queryClient";
import type { ApiResponse } from "../types/api";
import type { ChatThread } from "../types/chat";

export function ArchivedChatsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const {
    data,
    error,
    isPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.chatsArchived,
    queryFn: async ({ pageParam }) => {
      const res = await fetchArchivedChatThreads({ page: pageParam, perPage: 20 });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Failed to load archived chats");
      }
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.current_page < last.pagination.total_pages
        ? last.pagination.current_page + 1
        : undefined,
  });

  const threads = data?.pages.flatMap((p) => p.threads) ?? [];

  const unarchive = useMutation({
    mutationFn: async (threadId: number) => {
      const { data: res } = await http.post(`/chats/threads/${threadId}/unarchive`);
      return res as ApiResponse<void>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.chatsArchived });
      void qc.invalidateQueries({ queryKey: queryKeys.chats });
    },
  });

  const errorMessage =
    error instanceof Error ? error.message : error ? "Failed to load archived chats" : null;

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
    <div className="page">
      <div className="page-header-row">
        <div>
          <button type="button" className="btn-ghost chat-back" onClick={() => navigate("/chats")}>
            ← Chats
          </button>
          <h1>Archived</h1>
          <p className="muted">
            {isPending
              ? "Loading…"
              : threads.length > 0
                ? `${threads.length} archived conversation${threads.length === 1 ? "" : "s"}`
                : "No archived chats"}
          </p>
        </div>
      </div>

      {errorMessage ? <p className="error">{errorMessage}</p> : null}

      {!isPending && !errorMessage && threads.length === 0 ? (
        <div className="card empty-notifications">
          <h2>Nothing archived</h2>
          <p className="muted">Archive a chat from the main list to tuck it away here.</p>
          <Link to="/chats" className="btn-secondary" style={{ marginTop: 12 }}>
            Back to chats
          </Link>
        </div>
      ) : null}

      {threads.length > 0 ? (
        <>
          <ul className="chat-list">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button type="button" className="chat-row" onClick={() => openThread(thread)}>
                  <span className="chat-avatar">
                    {thread.peer.profile_picture ? (
                      <img src={thread.peer.profile_picture} alt="" className="chat-avatar-img" />
                    ) : (
                      <span className="chat-avatar-fallback">
                        {(thread.peer.name.trim()[0] || "?").toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="chat-row-body">
                    <span className="chat-row-top">
                      <span className="chat-peer-name">{thread.peer.name}</span>
                      <span className="chat-time">{formatShortDate(thread.last_message_at)}</span>
                    </span>
                    <span className="chat-preview">
                      {thread.errand_id
                        ? `${formatErrandCode(thread.errand_id)} · ${thread.last_message?.trim() || "No messages"}`
                        : `${formatChatCode(thread.id)} · ${thread.last_message?.trim() || "No messages"}`}
                    </span>
                  </span>
                  <span
                    className="chat-archive-btn"
                    role="button"
                    tabIndex={0}
                    aria-label="Unarchive chat"
                    title="Unarchive"
                    onClick={(e) => {
                      e.stopPropagation();
                      void unarchive.mutateAsync(thread.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        void unarchive.mutateAsync(thread.id);
                      }
                    }}
                  >
                    ↩
                  </span>
                </button>
              </li>
            ))}
          </ul>
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
