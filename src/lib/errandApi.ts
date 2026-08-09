import { http } from "./http";
import type { ApiResponse } from "../types/api";
import { parseChatThread, type ChatThread } from "../types/chat";
import type {
  Errand,
  ErrandOffer,
  ErrandProof,
  ErrandStatusFilter,
  ErrandsListResult,
} from "../types/errand";

export async function fetchMyErrands(params?: {
  status?: Exclude<ErrandStatusFilter, "all">;
  page?: number;
  perPage?: number;
}) {
  const { data } = await http.get<
    ApiResponse<{
      errands: Errand[];
      pagination: ErrandsListResult["pagination"];
    }>
  >("/errands/my-errands", {
    params: {
      status: params?.status,
      page: params?.page,
      per_page: params?.perPage ?? 20,
    },
  });

  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error,
    };
  }

  return {
    success: true as const,
    data: {
      errands: data.data.errands ?? [],
      pagination: data.data.pagination ?? {
        current_page: 1,
        total_pages: 1,
        total_items: data.data.errands?.length ?? 0,
      },
    } satisfies ErrandsListResult,
  };
}

export async function fetchErrand(errandId: number) {
  const { data } = await http.get<ApiResponse<Errand | { errand: Errand }>>(
    `/errands/${errandId}`,
  );
  if (!data.success || !data.data) {
    return data as ApiResponse<Errand>;
  }
  const payload = data.data;
  const errand =
    payload && typeof payload === "object" && "errand" in payload
      ? (payload as { errand: Errand }).errand
      : (payload as Errand);
  return { ...data, data: errand };
}

export async function fetchErrandOffers(errandId: number) {
  const { data } = await http.get<ApiResponse<{ offers: ErrandOffer[] }>>(
    `/errands/${errandId}/offers`,
  );
  if (!data.success) {
    return { success: false as const, data: null, error: data.error };
  }
  return {
    success: true as const,
    data: data.data?.offers ?? [],
  };
}

export async function cancelErrand(errandId: number) {
  const { data } = await http.post<ApiResponse<{ errand?: Errand }>>(
    `/errands/${errandId}/cancel`,
  );
  return data;
}

export async function acceptOffer(offerId: number) {
  const { data } = await http.post<ApiResponse<{ errand: Errand }>>(
    `/offers/${offerId}/accept`,
    { payment_method: "wallet" },
  );
  return data;
}

export async function createOrGetChatThread(recipientId: number, errandId?: number) {
  const { data } = await http.post<
    ApiResponse<{ thread?: unknown } | Record<string, unknown>>
  >("/chats/threads", {
    recipient_id: recipientId,
    errand_id: errandId,
  });

  if (!data.success || !data.data) {
    return { success: false as const, data: null as ChatThread | null, error: data.error };
  }

  const raw =
    data.data && typeof data.data === "object" && "thread" in data.data
      ? ((data.data as { thread?: unknown }).thread as Record<string, unknown> | undefined)
      : (data.data as Record<string, unknown>);

  if (!raw) {
    return {
      success: false as const,
      data: null as ChatThread | null,
      error: { message: "Could not open chat" },
    };
  }

  return {
    success: true as const,
    data: parseChatThread(raw),
  };
}

export type ErrandStats = {
  active_count: number;
  completed_count: number;
  cancelled_count: number;
  total_spent: number;
};

export async function fetchErrandStats() {
  const { data } = await http.get<ApiResponse<ErrandStats>>("/errands/stats");
  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to load stats" },
    };
  }
  return {
    success: true as const,
    data: data.data,
  };
}

export type ErrandTypeSchema = {
  id: number;
  slug: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  sort_order?: number;
  requires_pickup_location?: boolean;
  requires_dropoff_location?: boolean;
  allows_dropoff_location?: boolean;
};

export type ErrandEstimate = {
  estimate: {
    distance_km: number;
    duration_min: number;
  };
  suggested_price: {
    base: number;
    min: number;
    max: number;
    engine?: string;
    breakdown?: Record<string, unknown>;
  };
  service_zone: {
    serviceable: boolean;
    zone_id?: number | null;
    zone_name?: string | null;
    source?: string | null;
  };
};

export type CreateErrandPayload = {
  title: string;
  description?: string | null;
  category: string;
  type: "instant" | "scheduled";
  scheduled_at?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_address?: string | null;
  dropoff_latitude?: number | null;
  dropoff_longitude?: number | null;
  estimated_stops?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type CreateErrandResult = {
  errand: Errand;
  estimate?: ErrandEstimate["estimate"];
  suggested_price?: ErrandEstimate["suggested_price"];
  service_zone?: ErrandEstimate["service_zone"];
};

export async function fetchErrandTypeSchemas() {
  const { data } = await http.get<
    ApiResponse<{ errand_type_schemas: ErrandTypeSchema[] }>
  >("/errand-types/schema");
  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to load errand types" },
    };
  }
  return {
    success: true as const,
    data: data.data.errand_type_schemas ?? [],
  };
}

export async function estimateErrand(payload: {
  category: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
}) {
  try {
    const { data } = await http.post<ApiResponse<ErrandEstimate>>("/errands/estimate", payload);
    if (!data.success || !data.data) {
      return {
        success: false as const,
        data: null,
        error: data.error ?? { message: "Failed to estimate price", code: undefined as string | undefined },
      };
    }
    return { success: true as const, data: data.data };
  } catch (err: unknown) {
    const ax = err as { response?: { data?: ApiResponse<unknown> } };
    const body = ax.response?.data;
    return {
      success: false as const,
      data: null,
      error: {
        message: body?.error?.message ?? "Failed to estimate price",
        code: body?.error?.code,
      },
    };
  }
}

export async function createErrand(payload: CreateErrandPayload) {
  try {
    const { data } = await http.post<ApiResponse<CreateErrandResult>>("/errands", payload);
    if (!data.success || !data.data?.errand) {
      return {
        success: false as const,
        data: null,
        error: data.error ?? { message: "Failed to create errand", code: undefined as string | undefined },
      };
    }
    return { success: true as const, data: data.data, message: data.message };
  } catch (err: unknown) {
    const ax = err as { response?: { data?: ApiResponse<unknown> } };
    const body = ax.response?.data;
    return {
      success: false as const,
      data: null,
      error: {
        message: body?.error?.message ?? "Failed to create errand",
        code: body?.error?.code,
      },
    };
  }
}

export async function acceptErrandCompletion(errandId: number) {
  const { data } = await http.post<ApiResponse<{ proof?: ErrandProof }>>(
    `/errands/${errandId}/accept-completion`,
  );
  return data;
}

export async function rejectErrandCompletion(errandId: number, rejectionReason: string) {
  const { data } = await http.post<ApiResponse<{ proof?: ErrandProof }>>(
    `/errands/${errandId}/reject-completion`,
    { rejection_reason: rejectionReason },
  );
  return data;
}

export type ErrandReview = {
  id: number;
  rating: number;
  comment?: string | null;
  reviewer_role?: string | null;
  created_at?: string | null;
};

export async function submitErrandReview(
  errandId: number,
  payload: { rating: number; comment?: string | null },
) {
  const { data } = await http.post<ApiResponse<{ review: ErrandReview }>>(
    `/reviews/errands/${errandId}`,
    {
      rating: payload.rating,
      comment: payload.comment?.trim() || null,
    },
  );
  return data;
}
