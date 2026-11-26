import { http } from "./http";
import type { ApiResponse, OrganizationSummary } from "../types/api";

export type CreateOrganizationPayload = {
  name: string;
  cac_number?: string;
  address?: string;
  city?: string;
  state?: string;
  contact_email?: string;
  contact_phone?: string;
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

export async function createOrganization(payload: CreateOrganizationPayload) {
  const { data } = await http.post<
    ApiResponse<{ organization: OrganizationSummary; organizations: OrganizationSummary[] }>
  >("/organizations", payload);
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
