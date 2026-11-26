import type { OrganizationSummary } from "../types/api";

const STORAGE_KEY = "goquick_active_org_id";

export type OrgContextMode = "personal" | "business";

type Listener = () => void;

let memoryOrgId: number | null | undefined;
const listeners = new Set<Listener>();

function readStored(): number | null {
  if (memoryOrgId !== undefined) return memoryOrgId;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryOrgId = null;
      return null;
    }
    const id = Number(raw);
    memoryOrgId = Number.isFinite(id) && id > 0 ? id : null;
    return memoryOrgId;
  } catch {
    memoryOrgId = null;
    return null;
  }
}

function writeStored(id: number | null): void {
  memoryOrgId = id;
  try {
    if (id == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

export function getActiveOrganizationId(): number | null {
  return readStored();
}

/** Switch to personal (null) or a business org id. */
export function setActiveOrganizationId(id: number | null): void {
  writeStored(id);
}

export function subscribeOrgContext(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resolveActiveOrganization(
  orgs: OrganizationSummary[] | undefined | null,
): OrganizationSummary | null {
  const list = orgs ?? [];
  if (list.length === 0) return null;
  const activeId = getActiveOrganizationId();
  if (activeId == null) return null;
  return list.find((o) => o.id === activeId) ?? null;
}

/** Drop stale org id when memberships change (e.g. after logout/login). */
export function syncOrgContextWithMemberships(
  orgs: OrganizationSummary[] | undefined | null,
): void {
  const activeId = getActiveOrganizationId();
  if (activeId == null) return;
  const stillMember = (orgs ?? []).some((o) => o.id === activeId);
  if (!stillMember) setActiveOrganizationId(null);
}
