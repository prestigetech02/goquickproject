export type SupportTicketCategory = "account" | "errand" | "payment" | "kyc" | "other";

export type SupportTicketStatus = "open" | "awaiting_user" | "resolved" | "closed";

export type SupportTicketUser = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
};

export type SupportTicketMessage = {
  id: number;
  ticket_id: number;
  user_id: number;
  body: string;
  attachment_url: string | null;
  is_staff: boolean;
  user?: SupportTicketUser | null;
  created_at: string;
};

export type SupportTicket = {
  id: number;
  public_id: string;
  category: SupportTicketCategory | string;
  subject: string;
  status: SupportTicketStatus | string;
  errand_id: number | null;
  errand?: { id: number; title?: string | null; status?: string | null } | null;
  last_replied_at?: string | null;
  created_at: string;
  updated_at?: string;
  is_locked: boolean;
  can_reply: boolean;
  unread_count?: number;
  preview?: string | null;
  messages?: SupportTicketMessage[];
};

export type SupportTicketsPage = {
  tickets: SupportTicket[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export const SUPPORT_TICKET_STATUS_FILTERS: { value: "all" | SupportTicketStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "awaiting_user", label: "Awaiting you" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export const SUPPORT_TICKET_CATEGORIES: { value: SupportTicketCategory; label: string }[] = [
  { value: "account", label: "Account" },
  { value: "errand", label: "Errand" },
  { value: "payment", label: "Payment" },
  { value: "kyc", label: "KYC / verification" },
  { value: "other", label: "Other" },
];

export function supportTicketStatusLabel(status: string): string {
  switch (status) {
    case "awaiting_user":
      return "Awaiting you";
    case "open":
      return "Open";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return status.replace(/_/g, " ");
  }
}

export function supportTicketCategoryLabel(category: string): string {
  return SUPPORT_TICKET_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export function unreadCountLabel(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}
