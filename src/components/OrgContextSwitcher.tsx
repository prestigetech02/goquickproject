import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import {
  getActiveOrganizationId,
  setActiveOrganizationId,
  subscribeOrgContext,
  syncOrgContextWithMemberships,
} from "../lib/orgContext";
import { userHasBusiness, type OrganizationSummary, type User } from "../types/api";

function useActiveOrgId() {
  return useSyncExternalStore(subscribeOrgContext, getActiveOrganizationId, () => null);
}

type Props = {
  user: User | null | undefined;
};

export function OrgContextSwitcher({ user }: Props) {
  const orgs = user?.organizations ?? [];
  const activeId = useActiveOrgId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    syncOrgContextWithMemberships(orgs);
  }, [orgs]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!userHasBusiness(user)) return null;

  const activeOrg: OrganizationSummary | null =
    activeId != null ? (orgs.find((o) => o.id === activeId) ?? null) : null;
  const label = activeOrg ? activeOrg.name : "Personal";

  return (
    <div className="org-switcher" ref={rootRef}>
      <button
        type="button"
        className="org-switcher-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        title="Switch account context"
      >
        <span className="org-switcher-badge" aria-hidden>
          {activeOrg ? "B" : "P"}
        </span>
        <span className="org-switcher-label">{label}</span>
        <span className="org-switcher-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="org-switcher-menu" role="listbox" id={listId} aria-label="Account context">
          <button
            type="button"
            role="option"
            aria-selected={!activeOrg}
            className={`org-switcher-option${!activeOrg ? " selected" : ""}`}
            onClick={() => {
              setActiveOrganizationId(null);
              setOpen(false);
            }}
          >
            <strong>Personal</strong>
            <span className="muted">Your own errands &amp; wallet</span>
          </button>
          {orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              role="option"
              aria-selected={activeOrg?.id === org.id}
              className={`org-switcher-option${activeOrg?.id === org.id ? " selected" : ""}`}
              onClick={() => {
                setActiveOrganizationId(org.id);
                setOpen(false);
              }}
            >
              <strong>{org.name}</strong>
              <span className="muted">
                {org.status === "pending" ? "Pending review · " : ""}
                {org.role === "owner" ? "Owner" : org.role}
              </span>
            </button>
          ))}
          {orgs.some((o) => o.role === "owner") ? (
            <Link
              to="/profile/business/branches"
              className="org-switcher-manage"
              onClick={() => setOpen(false)}
            >
              Manage branches
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
