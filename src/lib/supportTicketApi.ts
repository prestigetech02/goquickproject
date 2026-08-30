import { http } from "./http";
import type { ApiResponse } from "../types/api";
import type { SupportTicket, SupportTicketsPage } from "../types/supportTicket";

export async function fetchSupportTickets(params?: {
  status?: string;
  page?: number;
  perPage?: number;
}): Promise<SupportTicketsPage> {
  const { data } = await http.get<
    ApiResponse<{
      tickets: SupportTicket[];
      pagination: SupportTicketsPage["pagination"];
    }>
  >("/support/tickets", {
    params: {
      status: params?.status,
      page: params?.page,
      per_page: params?.perPage ?? 20,
    },
  });

  if (!data.success || !data.data) {
    throw new Error(data.error?.message ?? "Failed to load tickets");
  }

  return {
    tickets: data.data.tickets ?? [],
    pagination: data.data.pagination ?? {
      current_page: 1,
      last_page: 1,
      per_page: params?.perPage ?? 20,
      total: data.data.tickets?.length ?? 0,
    },
  };
}

export async function fetchSupportTicketUnreadCount(): Promise<number> {
  try {
    const { data } = await http.get<ApiResponse<{ count: number }>>("/support/tickets/unread-count");
    if (!data.success) return 0;
    return Number(data.data?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function fetchSupportTicket(id: number): Promise<SupportTicket> {
  const { data } = await http.get<ApiResponse<{ ticket: SupportTicket }>>(`/support/tickets/${id}`);
  if (!data.success || !data.data?.ticket) {
    throw new Error(data.error?.message ?? "Failed to load ticket");
  }
  return data.data.ticket;
}

export async function createSupportTicket(payload: {
  category: string;
  subject: string;
  message: string;
  errandId?: number | null;
  attachment?: File | null;
}): Promise<SupportTicket> {
  const hasFile = Boolean(payload.attachment);
  if (hasFile && payload.attachment) {
    const form = new FormData();
    form.append("category", payload.category);
    form.append("subject", payload.subject);
    form.append("message", payload.message);
    if (payload.errandId) form.append("errand_id", String(payload.errandId));
    form.append("attachment", payload.attachment);
    const { data } = await http.post<ApiResponse<{ ticket: SupportTicket }>>("/support/tickets", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (!data.success || !data.data?.ticket) {
      throw new Error(data.error?.message ?? "Failed to create ticket");
    }
    return data.data.ticket;
  }

  const { data } = await http.post<ApiResponse<{ ticket: SupportTicket }>>("/support/tickets", {
    category: payload.category,
    subject: payload.subject,
    message: payload.message,
    errand_id: payload.errandId ?? undefined,
  });
  if (!data.success || !data.data?.ticket) {
    throw new Error(data.error?.message ?? "Failed to create ticket");
  }
  return data.data.ticket;
}

export async function replySupportTicket(
  id: number,
  payload: { message: string; attachment?: File | null },
): Promise<SupportTicket> {
  if (payload.attachment) {
    const form = new FormData();
    form.append("message", payload.message);
    form.append("attachment", payload.attachment);
    const { data } = await http.post<ApiResponse<{ ticket: SupportTicket }>>(
      `/support/tickets/${id}/messages`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    if (!data.success || !data.data?.ticket) {
      throw new Error(data.error?.message ?? "Failed to send reply");
    }
    return data.data.ticket;
  }

  const { data } = await http.post<ApiResponse<{ ticket: SupportTicket }>>(
    `/support/tickets/${id}/messages`,
    { message: payload.message },
  );
  if (!data.success || !data.data?.ticket) {
    throw new Error(data.error?.message ?? "Failed to send reply");
  }
  return data.data.ticket;
}

export async function fetchPublicSupportConfig(): Promise<{
  support_whatsapp_url?: string;
  support_email?: string;
}> {
  const { data } = await http.get("/config/public");
  if (data && typeof data === "object") {
    return data as { support_whatsapp_url?: string; support_email?: string };
  }
  return {};
}
