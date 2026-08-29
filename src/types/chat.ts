export type ChatPeer = {
  id: number;
  name: string;
  is_online: boolean;
  profile_picture: string | null;
  phone: string | null;
};

export type ChatThread = {
  id: number;
  peer: ChatPeer;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  missed_call_count: number;
  errand_id: number | null;
  is_archived: boolean;
  is_read_only: boolean;
  errand_status: string | null;
};

export type ChatAttachmentType = "image" | "document" | "video" | null;
export type ChatMessageType = "text" | "missed_call" | string;
export type ChatMessageStatus = "sending" | "sent" | "delivered" | "read" | "failed" | string;

export type ChatReplyPreview = {
  id: number;
  message: string;
  status: string;
  sender_id: number;
  created_at: string;
  message_type?: string;
};

export type ChatMessage = {
  id: number;
  client_id: string | null;
  message: string;
  status: ChatMessageStatus;
  sender_id: number;
  created_at: string;
  reply_to_id: number | null;
  reply_to_message: ChatReplyPreview | null;
  message_type: ChatMessageType;
  attachment_url: string | null;
  attachment_type: ChatAttachmentType;
  attachment_name: string | null;
  attachment_size: number | null;
};

export type ChatMessagesPayload = {
  messages: ChatMessage[];
  current_user_id: number;
  peer: ChatPeer;
  /** True when older messages exist beyond the loaded window */
  has_more?: boolean;
  is_read_only?: boolean;
  errand_status?: string | null;
};

export type ChatThreadsPage = {
  threads: ChatThread[];
  unread_total: number;
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
    per_page: number;
  };
};

export function parseChatThread(raw: Record<string, unknown>): ChatThread {
  const peerRaw =
    raw.peer && typeof raw.peer === "object" && !Array.isArray(raw.peer)
      ? (raw.peer as Record<string, unknown>)
      : {};

  return {
    id: Number(raw.id) || 0,
    peer: {
      id: Number(peerRaw.id) || 0,
      name: String(peerRaw.name ?? "").trim() || "Unknown",
      is_online: peerRaw.is_online === true,
      profile_picture:
        peerRaw.profile_picture != null ? String(peerRaw.profile_picture) : null,
      phone: peerRaw.phone != null ? String(peerRaw.phone) : null,
    },
    last_message: raw.last_message != null ? String(raw.last_message) : null,
    last_message_at:
      raw.last_message_at != null ? String(raw.last_message_at) : null,
    unread_count: Number(raw.unread_count) || 0,
    missed_call_count: Number(raw.missed_call_count) || 0,
    errand_id: raw.errand_id != null ? Number(raw.errand_id) : null,
    is_archived: raw.is_archived === true,
    is_read_only: raw.is_read_only === true,
    errand_status: raw.errand_status != null ? String(raw.errand_status) : null,
  };
}

function parseReply(raw: unknown): ChatReplyPreview | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id) || 0,
    message: String(r.message ?? ""),
    status: String(r.status ?? "sent"),
    sender_id: Number(r.sender_id) || 0,
    created_at: String(r.created_at ?? ""),
    message_type: r.message_type != null ? String(r.message_type) : undefined,
  };
}

export function parseChatMessage(raw: Record<string, unknown>): ChatMessage {
  const attachmentType = raw.attachment_type != null ? String(raw.attachment_type) : null;
  return {
    id: Number(raw.id) || 0,
    client_id: raw.client_id != null ? String(raw.client_id) : null,
    message: String(raw.message ?? ""),
    status: String(raw.status ?? "sent"),
    sender_id: Number(raw.sender_id) || 0,
    created_at: String(raw.created_at ?? new Date().toISOString()),
    reply_to_id: raw.reply_to_id != null ? Number(raw.reply_to_id) : null,
    reply_to_message: parseReply(raw.reply_to_message),
    message_type: String(raw.message_type ?? "text"),
    attachment_url: raw.attachment_url != null ? String(raw.attachment_url) : null,
    attachment_type:
      attachmentType === "image" || attachmentType === "document" || attachmentType === "video"
        ? attachmentType
        : null,
    attachment_name: raw.attachment_name != null ? String(raw.attachment_name) : null,
    attachment_size: raw.attachment_size != null ? Number(raw.attachment_size) : null,
  };
}

export function parseChatPeer(raw: Record<string, unknown> | null | undefined): ChatPeer {
  if (!raw) {
    return { id: 0, name: "Unknown", is_online: false, profile_picture: null, phone: null };
  }
  return {
    id: Number(raw.id) || 0,
    name: String(raw.name ?? "").trim() || "Unknown",
    is_online: raw.is_online === true,
    profile_picture: raw.profile_picture != null ? String(raw.profile_picture) : null,
    phone: raw.phone != null ? String(raw.phone) : null,
  };
}
