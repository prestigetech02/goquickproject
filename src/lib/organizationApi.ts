import { http } from "./http";
import type { ApiResponse, OrganizationSummary } from "../types/api";
import type { FundWalletResult, WalletInfo, WalletTransactionsResult } from "./walletApi";

export type CreateOrganizationPayload = {
  name: string;
  cac_number?: string;
  address?: string;
  city?: string;
  state?: string;
  contact_email?: string;
  contact_phone?: string;
  first_name: string;
  last_name: string;
  lga: string;
  director_id_type: "nin" | "voters_card" | "passport" | "drivers_license" | string;
  director_id_number: string;
  director_id_document: File;
  proof_of_address: File;
};

export type OrganizationKybResult = {
  organization: OrganizationSummary;
  organizations: OrganizationSummary[];
  kyb: {
    status: string;
    address_status: string;
    can_proceed: boolean;
    failure_reason?: string | null;
  };
};

export type OrganizationLocation = {
  id: number;
  organization_id: number;
  name: string;
  address: string;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
  sort_order: number;
};

export type CreateOrganizationLocationPayload = {
  name: string;
  address: string;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export async function fetchMyOrganizations() {
  const { data } = await http.get<ApiResponse<{ organizations: OrganizationSummary[] }>>(
    "/organizations",
  );
  return data;
}

function toOrganizationFormData(payload: CreateOrganizationPayload): FormData {
  const form = new FormData();
  form.append("name", payload.name);
  if (payload.cac_number) form.append("cac_number", payload.cac_number);
  if (payload.address) form.append("address", payload.address);
  if (payload.city) form.append("city", payload.city);
  if (payload.state) form.append("state", payload.state);
  if (payload.contact_email) form.append("contact_email", payload.contact_email);
  if (payload.contact_phone) form.append("contact_phone", payload.contact_phone);
  form.append("first_name", payload.first_name);
  form.append("last_name", payload.last_name);
  form.append("lga", payload.lga);
  form.append("director_id_type", payload.director_id_type);
  form.append("director_id_number", payload.director_id_number);
  form.append("director_id_document", payload.director_id_document);
  form.append("proof_of_address", payload.proof_of_address);
  return form;
}

export async function createOrganization(payload: CreateOrganizationPayload) {
  const { data } = await http.post<ApiResponse<OrganizationKybResult>>("/organizations", toOrganizationFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function resubmitOrganizationKyb(
  organizationId: number,
  payload: Omit<CreateOrganizationPayload, "name" | "cac_number" | "address" | "city" | "state" | "contact_email" | "contact_phone">,
) {
  const form = new FormData();
  form.append("first_name", payload.first_name);
  form.append("last_name", payload.last_name);
  form.append("lga", payload.lga);
  form.append("director_id_type", payload.director_id_type);
  form.append("director_id_number", payload.director_id_number);
  form.append("director_id_document", payload.director_id_document);
  form.append("proof_of_address", payload.proof_of_address);

  const { data } = await http.post<ApiResponse<OrganizationKybResult>>(
    `/organizations/${organizationId}/kyb`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function fetchOrganizationLocations(organizationId: number) {
  const { data } = await http.get<ApiResponse<{ locations: OrganizationLocation[] }>>(
    `/organizations/${organizationId}/locations`,
  );
  return data;
}

export async function createOrganizationLocation(
  organizationId: number,
  payload: CreateOrganizationLocationPayload,
) {
  const { data } = await http.post<ApiResponse<{ location: OrganizationLocation }>>(
    `/organizations/${organizationId}/locations`,
    payload,
  );
  return data;
}

export async function updateOrganizationLocation(
  organizationId: number,
  locationId: number,
  payload: Partial<CreateOrganizationLocationPayload> & { is_active?: boolean },
) {
  const { data } = await http.put<ApiResponse<{ location: OrganizationLocation }>>(
    `/organizations/${organizationId}/locations/${locationId}`,
    payload,
  );
  return data;
}

export async function deleteOrganizationLocation(organizationId: number, locationId: number) {
  const { data } = await http.delete<ApiResponse<unknown>>(
    `/organizations/${organizationId}/locations/${locationId}`,
  );
  return data;
}

export async function fetchOrganizationWallet(organizationId: number) {
  const { data } = await http.get<
    ApiResponse<{ wallet: WalletInfo & { organization_id?: number }; organization?: OrganizationSummary }>
  >(`/organizations/${organizationId}/wallet`);
  if (!data.success || !data.data?.wallet) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to load business wallet" },
    };
  }
  return { success: true as const, data: data.data.wallet };
}

export async function fetchOrganizationWalletTransactions(
  organizationId: number,
  params?: { page?: number; perPage?: number },
) {
  const { data } = await http.get<ApiResponse<WalletTransactionsResult>>(
    `/organizations/${organizationId}/wallet/transactions`,
    {
      params: {
        page: params?.page ?? 1,
        per_page: params?.perPage ?? 20,
      },
    },
  );
  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to load transactions" },
    };
  }
  return { success: true as const, data: data.data };
}

export async function fundOrganizationWallet(
  organizationId: number,
  payload: { amount: number; email?: string; callbackUrl?: string },
) {
  const { data } = await http.post<ApiResponse<FundWalletResult>>(
    `/organizations/${organizationId}/wallet/fund`,
    {
      amount: payload.amount,
      email: payload.email,
      callback_url: payload.callbackUrl,
    },
  );
  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to start funding" },
    };
  }
  return { success: true as const, data: data.data, message: data.message };
}

export async function verifyOrganizationWalletFunding(organizationId: number, reference: string) {
  const { data } = await http.get<
    ApiResponse<{ transaction: { id: number; status: string }; wallet_balance: number }>
  >(`/organizations/${organizationId}/wallet/fund/verify/${encodeURIComponent(reference)}`);
  if (!data.success || !data.data) {
    return {
      success: false as const,
      data: null,
      error: data.error ?? { message: "Failed to verify payment" },
    };
  }
  return { success: true as const, data: data.data };
}

export type OrganizationApiKey = {
  id: number;
  name: string;
  environment: "live" | "test" | string;
  masked_key: string;
  allowed_ips?: string[];
  ip_allowlist_enabled?: boolean;
  last_used_at?: string | null;
  revoked_at?: string | null;
  is_active: boolean;
  created_at?: string | null;
};

export type OrganizationApiKeysPayload = {
  partner_api_enabled: boolean;
  organization: { id: number; name: string; status: string };
  keys: OrganizationApiKey[];
};

export async function fetchOrganizationApiKeys(organizationId: number) {
  const { data } = await http.get<ApiResponse<OrganizationApiKeysPayload>>(
    `/organizations/${organizationId}/api-keys`,
  );
  return data;
}

export async function createOrganizationApiKey(
  organizationId: number,
  payload: { name: string; environment?: "live" | "test"; allowed_ips?: string[] | string },
) {
  const { data } = await http.post<
    ApiResponse<{ key: OrganizationApiKey; token: string; partner_api_enabled: boolean }>
  >(`/organizations/${organizationId}/api-keys`, payload);
  return data;
}

export async function updateOrganizationApiKey(
  organizationId: number,
  apiKeyId: number,
  payload: { name?: string; allowed_ips?: string[] | string | null },
) {
  const { data } = await http.put<ApiResponse<{ key: OrganizationApiKey }>>(
    `/organizations/${organizationId}/api-keys/${apiKeyId}`,
    payload,
  );
  return data;
}

export async function revokeOrganizationApiKey(organizationId: number, apiKeyId: number) {
  const { data } = await http.post<ApiResponse<{ key: OrganizationApiKey }>>(
    `/organizations/${organizationId}/api-keys/${apiKeyId}/revoke`,
  );
  return data;
}

export type OrganizationWebhookEndpoint = {
  id: number;
  organization_id: number;
  url: string;
  enabled_events: string[];
  is_active: boolean;
  secret_hint?: string;
  secret?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OrganizationWebhookDelivery = {
  id: number;
  event_id: string;
  event: string;
  attempt: number;
  response_status?: number | null;
  success: boolean;
  error_message?: string | null;
  errand_id?: number | null;
  duration_ms?: number | null;
  created_at?: string | null;
};

export async function fetchOrganizationWebhook(organizationId: number) {
  const { data } = await http.get<
    ApiResponse<{
      partner_api_enabled: boolean;
      endpoint: OrganizationWebhookEndpoint | null;
      available_events: string[];
    }>
  >(`/organizations/${organizationId}/webhook`);
  return data;
}

export async function upsertOrganizationWebhook(
  organizationId: number,
  payload: {
    url: string;
    is_active?: boolean;
    enabled_events?: string[];
    rotate_secret?: boolean;
  },
) {
  const { data } = await http.put<ApiResponse<{ endpoint: OrganizationWebhookEndpoint }>>(
    `/organizations/${organizationId}/webhook`,
    payload,
  );
  return data;
}

export async function fetchOrganizationWebhookDeliveries(
  organizationId: number,
  params?: { page?: number; per_page?: number },
) {
  const { data } = await http.get<
    ApiResponse<{
      deliveries: OrganizationWebhookDelivery[];
      pagination: { current_page: number; per_page: number; total: number; last_page: number };
    }>
  >(`/organizations/${organizationId}/webhook/deliveries`, { params });
  return data;
}
