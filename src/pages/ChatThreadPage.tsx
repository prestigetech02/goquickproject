import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useLocation, useParams } from "react-router-dom";
import { ChatArchivesMenu } from "../components/ChatArchivesMenu";
import { formatDayLabel, formatTime } from "../lib/datetime";
import { formatChatCode, formatErrandCode } from "../lib/publicId";
import { getApiErrorMessage } from "../lib/http";
import {
  useChatMessagesQuery,
  useChatThreadsQuery,
  useLoadOlderChatMessages,
  useMarkChatReadMutation,
  useSendChatMessageMutation,
} from "../lib/queries";
import { setActiveChatThreadId, setThreadUnread } from "../lib/chatCache";
import { queryClient } from "../lib/queryClient";
import { useChatThreadRealtime } from "../lib/useChatThreadRealtime";
import type { ChatMessage } from "../types/chat";

type ChatThreadLocationState = {
  peerName?: string;
  peerId?: number;
  isOnline?: boolean;
  peerProfilePicture?: string | null;
  errandId?: number | null;
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function clientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function StatusTicks({ status, mine }: { status: string; mine: boolean }) {
  if (!mine) return null;
  if (status === "sending") return <span className="msg-status">…</span>;
  if (status === "failed") return <span className="msg-status failed">!</span>;
  if (status === "read") return <span className="msg-status read">✓✓</span>;
  if (status === "delivered") return <span className="msg-status">✓✓</span>;
  return <span className="msg-status">✓</span>;
}

function MessageBubble({
  message: m,
  mine,
  peerName,
  peerPicture,
  onReply,
}: {
  message: ChatMessage;
  mine: boolean;
  peerName: string;
  peerPicture: string | null;
  onReply: (m: ChatMessage) => void;
}) {
  const isMissed = m.message_type === "missed_call";
  if (isMissed) {
    return (
      <div className="msg-system">
        <span>Missed call</span>
        <span className="msg-time">{formatTime(m.created_at)}</span>
      </div>
    );
  }

  const initial = (peerName.trim()[0] || "?").toUpperCase();

  return (
    <div className={`msg-row${mine ? " mine" : " theirs"}`}>
      {!mine ? (
        <span className="msg-avatar" aria-hidden="true">
          {peerPicture ? (
            <img src={peerPicture} alt="" />
          ) : (
            <span>{initial}</span>
          )}
        </span>
      ) : null}
      <div className="msg-stack">
        <div className="msg-bubble">
          {m.reply_to_message ? (
            <div className="msg-reply-quote">
              <span className="msg-reply-label">Reply</span>
              <span className="msg-reply-text">{m.reply_to_message.message}</span>
            </div>
          ) : null}

          {m.attachment_type === "image" && m.attachment_url ? (
            <a
              className="msg-image-link"
              href={m.attachment_url}
              target="_blank"
              rel="noreferrer"
            >
              <img src={m.attachment_url} alt={m.attachment_name ?? "Image"} className="msg-image" />
            </a>
          ) : null}

          {m.attachment_type === "document" && m.attachment_url ? (
            <a
              className="msg-doc-link"
              href={m.attachment_url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="msg-doc-icon" aria-hidden="true">
                📄
              </span>
              <span className="msg-doc-name">{m.attachment_name || "Document"}</span>
            </a>
          ) : null}

          {m.message &&
          !(
            (m.attachment_type === "image" || m.attachment_type === "document") &&
            (m.message.startsWith("📷") ||
              m.message.startsWith("📄") ||
              m.message.startsWith("📎"))
          ) ? (
            <p className="msg-text">{m.message}</p>
          ) : null}

          <button
            type="button"
            className="msg-reply-btn"
            aria-label="Reply"
            title="Reply"
            onClick={() => onReply(m)}
          >
            ↩
          </button>
        </div>
        <div className={`msg-meta${mine ? " mine" : ""}`}>
          <span className="msg-time">{formatTime(m.created_at)}</span>
          <StatusTicks status={m.status} mine={mine} />
        </div>
      </div>
    </div>
  );
}

export function ChatThreadPage() {
  const { threadId: threadIdParam } = useParams();
  const location = useLocation();
  const state = (location.state ?? {}) as ChatThreadLocationState;
  const threadId = threadIdParam ? Number(threadIdParam) : NaN;
  const validId = Number.isFinite(threadId) && threadId > 0 ? threadId : null;

  const { data: threads = [] } = useChatThreadsQuery();
  const { live, peerTyping, sendTyping } = useChatThreadRealtime(validId);
  const { data, error, isPending, isFetching } = useChatMessagesQuery(validId, { live });
  const markRead = useMarkChatReadMutation(validId ?? 0);
  const sendMutation = useSendChatMessageMutation(validId ?? 0);
  const loadOlder = useLoadOlderChatMessages(validId ?? 0);

  const fromCache = validId != null ? threads.find((t) => t.id === validId) : undefined;
  const peer = data?.peer;
  const peerName =
    state.peerName ?? peer?.name ?? fromCache?.peer.name ?? "Chat";
  const errandId = state.errandId ?? fromCache?.errand_id ?? null;
  const isOnline =
    peer?.is_online ?? state.isOnline ?? fromCache?.peer.is_online ?? false;
  const picture =
    peer?.profile_picture ??
    state.peerProfilePicture ??
    fromCache?.peer.profile_picture ??
    null;
  const initial = (peerName.trim()[0] || "?").toUpperCase();
  const currentUserId = data?.current_user_id ?? 0;

  const messages = data?.messages ?? [];
  const hasMoreOlder = Boolean(data?.has_more);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const stickBottomRef = useRef(true);
  const typingActiveRef = useRef(false);
  const typingStopTimerRef = useRef<number | null>(null);

  const grouped = useMemo(() => {
    const items: Array<{ type: "day"; label: string; key: string } | { type: "msg"; message: ChatMessage }> =
      [];
    let lastDay = "";
    for (const m of messages) {
      const key = dayKey(m.created_at);
      if (key !== lastDay) {
        items.push({ type: "day", label: formatDayLabel(m.created_at), key: `day-${key}` });
        lastDay = key;
      }
      items.push({ type: "msg", message: m });
    }
    return items;
  }, [messages]);

  useEffect(() => {
    const prev = prevLenRef.current;
    const next = messages.length;
    // Only auto-scroll when messages grow at the end (not when older history is prepended)
    if (stickBottomRef.current && (next > prev || peerTyping)) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLenRef.current = next;
  }, [messages.length, validId, peerTyping]);

  useEffect(() => {
    prevLenRef.current = 0;
    stickBottomRef.current = true;
  }, [validId]);

  function stopTypingSignal() {
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (!typingActiveRef.current) return;
    typingActiveRef.current = false;
    sendTyping(false);
  }

  function notifyTyping() {
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      sendTyping(true);
    }
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }
    typingStopTimerRef.current = window.setTimeout(() => {
      stopTypingSignal();
    }, 2000);
  }

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }
      if (typingActiveRef.current) {
        typingActiveRef.current = false;
        sendTyping(false);
      }
    };
  }, [validId, sendTyping]);

  async function handleLoadOlder() {
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    stickBottomRef.current = false;
    try {
      await loadOlder.mutateAsync();
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollTop = el.scrollHeight - prevHeight + prevTop;
      });
    } catch {
      // surfaced via mutation state if needed
    }
  }

  useEffect(() => {
    setDraft("");
    setReplyTo(null);
    setPendingFile(null);
    setSendError(null);
  }, [validId]);

  useEffect(() => {
    if (validId == null) return;
    setActiveChatThreadId(validId);
    setThreadUnread(queryClient, validId, 0);
    void markRead.mutateAsync().catch(() => {
      // non-critical
    });
    return () => setActiveChatThreadId(null);
    // markRead.mutateAsync identity can change; only re-run when the thread changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validId]);

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    if (validId == null || sendMutation.isPending) return;
    const text = draft.trim();
    if (!text && !pendingFile) return;

    setSendError(null);
    stopTypingSignal();
    const cid = clientId();
    const replyId = replyTo?.id;
    const file = pendingFile;
    stickBottomRef.current = true;

    setDraft("");
    setReplyTo(null);
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
    stickBottomRef.current = true;

    try {
      const res = await sendMutation.mutateAsync({
        message: text || undefined,
        replyToId: replyId,
        clientId: cid,
        attachment: file ?? undefined,
      });
      if (!res.success) {
        setSendError(res.error?.message ?? "Failed to send");
        setDraft(text);
        setPendingFile(file);
        if (replyId) {
          const original = messages.find((m) => m.id === replyId) ?? null;
          setReplyTo(original);
        }
      }
    } catch (err) {
      setSendError(getApiErrorMessage(err, "Failed to send"));
      setDraft(text);
      setPendingFile(file);
    }
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  if (validId == null) {
    return (
      <div className="chats-thread-empty">
        <h2>Invalid chat</h2>
        <p className="muted">This conversation could not be opened.</p>
      </div>
    );
  }

  const errorMessage =
    error instanceof Error ? error.message : error ? "Failed to load messages" : null;

  return (
    <div className="chat-thread">
      <header className="chat-thread-header">
        <div className="chat-thread-peer">
          <span className="chat-avatar chat-thread-avatar">
            {picture ? (
              <img src={picture} alt="" className="chat-avatar-img" />
            ) : (
              <span className="chat-avatar-fallback">{initial}</span>
            )}
          </span>
          <span className="chat-thread-peer-text">
            <span className="chat-thread-name">{peerName}</span>
            <span
              className={`chat-thread-status${peerTyping || isOnline ? " online" : ""}`}
            >
              <span className="chat-thread-status-dot" aria-hidden="true" />
              {(() => {
                const publicId =
                  errandId != null
                    ? formatErrandCode(errandId)
                    : Number.isFinite(threadId) && threadId > 0
                      ? formatChatCode(threadId)
                      : "";
                if (peerTyping) return "Typing…";
                if (publicId && isOnline) return `${publicId} · Active`;
                if (isOnline) return "Active";
                if (publicId) return publicId;
                if (isFetching && !isPending) return "Updating…";
                return "Offline";
              })()}
            </span>
          </span>
        </div>
        <div className="chat-thread-actions">
          <ChatArchivesMenu />
        </div>
      </header>

      <div className="chat-thread-body" ref={listRef}>
        {isPending && messages.length === 0 ? (
          <div className="chat-messages-loading" aria-busy="true" aria-live="polite">
            <p className="chat-loading-text">
              Loading conversation
              <span className="chat-loading-dots" aria-hidden>
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </p>
          </div>
        ) : null}

        {errorMessage && messages.length === 0 ? (
          <p className="error" style={{ padding: 16 }}>
            {errorMessage}
          </p>
        ) : null}

        {!isPending && messages.length === 0 && !errorMessage ? (
          <div className="chats-thread-empty chats-thread-placeholder">
            <div className="empty-notifications-icon" aria-hidden="true">
              💬
            </div>
            <h2>Say hello</h2>
            <p className="muted">No messages yet — send the first one below.</p>
          </div>
        ) : null}

        {grouped.length > 0 ? (
          <div className="chat-messages">
            {hasMoreOlder ? (
              <div className="chat-load-older">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={loadOlder.isPending}
                  onClick={() => void handleLoadOlder()}
                >
                  {loadOlder.isPending ? "Loading…" : "Load older messages"}
                </button>
              </div>
            ) : null}
            {grouped.map((item) =>
              item.type === "day" ? (
                <div key={item.key} className="msg-day">
                  <span>{item.label}</span>
                </div>
              ) : (
                <MessageBubble
                  key={item.message.client_id ?? item.message.id}
                  message={item.message}
                  mine={item.message.sender_id === currentUserId}
                  peerName={peerName}
                  peerPicture={picture}
                  onReply={setReplyTo}
                />
              ),
            )}
            {peerTyping ? (
              <div className="msg-row theirs" aria-live="polite">
                <span className="msg-avatar" aria-hidden="true">
                  {picture ? (
                    <img src={picture} alt="" />
                  ) : (
                    <span>{initial}</span>
                  )}
                </span>
                <div className="msg-stack">
                  <div className="msg-bubble msg-typing-bubble">
                    <span className="msg-typing-dots" aria-label={`${peerName} is typing`}>
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        ) : null}

        {peerTyping && grouped.length === 0 && !isPending ? (
          <div className="chat-messages">
            <div className="msg-row theirs" aria-live="polite">
              <span className="msg-avatar" aria-hidden="true">
                {picture ? <img src={picture} alt="" /> : <span>{initial}</span>}
              </span>
              <div className="msg-stack">
                <div className="msg-bubble msg-typing-bubble">
                  <span className="msg-typing-dots" aria-label={`${peerName} is typing`}>
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              </div>
            </div>
            <div ref={bottomRef} />
          </div>
        ) : null}
      </div>

      <footer className="chat-composer">
        {replyTo ? (
          <div className="chat-reply-bar">
            <div className="chat-reply-bar-text">
              <strong>Replying</strong>
              <span>{replyTo.message || "Attachment"}</span>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setReplyTo(null)}>
              ×
            </button>
          </div>
        ) : null}

        {pendingFile ? (
          <div className="chat-attach-bar">
            <span>
              {pendingFile.type.startsWith("image/") ? "📷" : "📄"} {pendingFile.name}
            </span>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setPendingFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Remove
            </button>
          </div>
        ) : null}

        {sendError ? <p className="error chat-send-error">{sendError}</p> : null}

        <form className="chat-composer-row" onSubmit={(e) => void handleSend(e)}>
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setPendingFile(file);
            }}
          />
          <button
            type="button"
            className="chat-attach-btn"
            aria-label="Attach file"
            title="Attach"
            onClick={() => fileRef.current?.click()}
          >
            +
          </button>
          <textarea
            className="chat-input"
            rows={1}
            placeholder="Enter message..."
            value={draft}
            onChange={(e) => {
              const value = e.target.value;
              setDraft(value);
              if (value.trim()) notifyTyping();
              else stopTypingSignal();
            }}
            onBlur={() => stopTypingSignal()}
            onKeyDown={onComposerKey}
          />
          <button
            type="submit"
            className="chat-send-btn"
            aria-label={sendMutation.isPending ? "Sending" : "Send"}
            disabled={sendMutation.isPending || (!draft.trim() && !pendingFile)}
          >
            {sendMutation.isPending ? (
              <span className="chat-send-pending" aria-hidden="true">
                …
              </span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3.4 20.4l17.45-7.48c.81-.35.81-1.49 0-1.84L3.4 3.6a1 1 0 00-1.4.91v5.65c0 .46.31.86.76.97L8.5 12l-5.74.87a1 1 0 00-.76.97v5.65c0 .72.75 1.21 1.4.91z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}
