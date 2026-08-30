import { useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogoutConfirmModal } from "../components/LogoutConfirmModal";
import { useToast } from "../components/ToastProvider";
import { clearSession } from "../lib/auth";
import { logout } from "../lib/authApi";
import { config } from "../lib/config";
import { getApiErrorMessage } from "../lib/http";
import { useProfileQuery, useSupportTicketsUnreadCountQuery, useUploadProfilePictureMutation } from "../lib/queries";
import { isProfileComplete } from "../types/api";
import { unreadCountLabel } from "../types/supportTicket";

function initials(first?: string | null, last?: string | null) {
  const a = first?.trim()?.[0] ?? "";
  const b = last?.trim()?.[0] ?? "";
  const s = `${a}${b}`.toUpperCase();
  return s || "G";
}

function MenuLink({
  to,
  title,
  subtitle,
  danger,
  badge,
  ariaLabel,
  onClick,
}: {
  to?: string;
  title: string;
  subtitle?: string;
  danger?: boolean;
  badge?: string | null;
  ariaLabel?: string;
  onClick?: () => void;
}) {
  const className = `profile-menu-item${danger ? " danger" : ""}`;
  const inner = (
    <>
      <span className="profile-menu-text">
        <span className="profile-menu-title">{title}</span>
        {subtitle ? <span className="profile-menu-sub">{subtitle}</span> : null}
      </span>
      {badge ? (
        <span className="profile-menu-count" aria-hidden>
          {badge}
        </span>
      ) : null}
      <span className="profile-menu-chevron" aria-hidden>
        ›
      </span>
    </>
  );
  if (to) {
    return (
      <NavLink
        to={to}
        className={({ isActive }) => `${className}${isActive ? " active" : ""}`}
        aria-label={ariaLabel}
      >
        {inner}
      </NavLink>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} aria-label={ariaLabel}>
      {inner}
    </button>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { pathname } = useLocation();
  const hasSection = pathname.replace(/\/$/, "") !== "/profile";

  const { data: user, error, isPending, refetch } = useProfileQuery();
  const unreadTicketsQuery = useSupportTicketsUnreadCountQuery();
  const ticketUnread = unreadTicketsQuery.data ?? 0;
  const ticketUnreadLabel = unreadCountLabel(ticketUnread);
  const uploadPic = useUploadProfilePictureMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const name =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || "Requester";
  const profileDone = isProfileComplete(user ?? null);
  const referralCode = user?.referral?.referral_code?.trim() || "";
  const remainingDiscounts = user?.referral?.requester?.remaining_discounts ?? 0;
  const errorMessage =
    error instanceof Error ? error.message : error ? "Could not load profile." : null;

  async function confirmLogout() {
    setLoggingOut(true);
    await logout();
    clearSession();
    navigate("/login", { replace: true });
  }

  async function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo must be 2MB or smaller.");
      return;
    }
    setUploadProgress(0);
    try {
      await uploadPic.mutateAsync({
        file,
        onProgress: (percent) => setUploadProgress(percent),
      });
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to upload photo."));
    } finally {
      setUploadProgress(null);
    }
  }

  async function copyReferral() {
    if (!referralCode) return;
    const text = `Use my GoQuick referral code ${referralCode} to get ₦500 off your first errand.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyDone(true);
      toast.success("Referral message copied.");
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      window.prompt("Copy your referral message:", text);
    }
  }

  return (
    <div className={`profile-split${hasSection ? " has-section" : ""}`}>
      <aside className="profile-list-panel">
        <div className="profile-list-scroll page profile-page">
          <h1>Profile</h1>

          {errorMessage ? (
            <p className="error">
              {errorMessage}{" "}
              <button type="button" className="linkish" onClick={() => void refetch()}>
                Retry
              </button>
            </p>
          ) : null}

          {!profileDone && user ? (
            <div className="profile-banner">
              <div>
                <strong>Profile incomplete</strong>
                <p className="muted">Add your details to post errands and use wallet.</p>
              </div>
              <Link to="/complete-profile" className="btn-primary">
                Complete profile
              </Link>
            </div>
          ) : null}

          <section className="profile-hero">
            <button
              type="button"
              className="profile-avatar-btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploadPic.isPending || isPending || uploadProgress != null}
              aria-label="Change profile photo"
            >
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt="" className="profile-avatar-img" />
              ) : (
                <span className="profile-avatar-fallback">
                  {initials(user?.first_name, user?.last_name)}
                </span>
              )}
              <span className="profile-avatar-badge" aria-hidden>
                {uploadProgress != null ? "…" : "✎"}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => void handlePhotoChange(e.target.files?.[0])}
            />
            <div>
              <p className="profile-hero-name">{isPending && !user ? "Loading…" : name}</p>
              <p className="profile-hero-meta">
                <span>{user?.phone || "No phone"}</span>
                <span className="profile-hero-sep" aria-hidden>
                  ·
                </span>
                <span>{user?.email || "No email"}</span>
              </p>
            </div>
          </section>

          {config.referralEnabled ? (
          <div className="profile-cards-row">
            <section className="card profile-referral-card">
              <h2 className="profile-card-title">Invite &amp; earn</h2>
              <p className="muted profile-referral-copy">
                {referralCode
                  ? "Share your code with friends. Earn ₦1,000 when their first errand completes."
                  : "We are generating your invite code…"}
              </p>
              {referralCode ? (
                <div className="profile-referral-row">
                  <code className="profile-referral-code">{referralCode}</code>
                  <button type="button" className="btn-ghost" onClick={() => void copyReferral()}>
                    {copyDone ? "Copied" : "Copy & share"}
                  </button>
                </div>
              ) : null}
              {remainingDiscounts > 0 ? (
                <p className="profile-bonus">
                  You still have ₦500 off your first errand as a welcome bonus.
                </p>
              ) : null}
            </section>
          </div>
          ) : null}

          <nav className="card profile-menu" aria-label="Account">
            <MenuLink
              to="/profile/personal"
              title="My Profile"
              subtitle="Name, address, and contact details"
            />
            <MenuLink
              to="/wallet"
              title="My Wallet"
              subtitle="Balance, top-ups, and transactions"
            />
            <MenuLink
              to="/profile/security"
              title="Account & Security"
              subtitle="Password and account controls"
            />
            <MenuLink
              to="/profile/notifications"
              title="Notification Settings"
              subtitle="Choose what you hear about"
            />
            <MenuLink
              to="/profile/help"
              title="Help & Support"
              subtitle="Tickets, FAQs, and contact"
              badge={ticketUnreadLabel}
              ariaLabel={
                ticketUnread > 0
                  ? `Help & Support, ${ticketUnread} unread ${ticketUnread === 1 ? "reply" : "replies"} from support`
                  : undefined
              }
            />
            <a
              className="profile-menu-item"
              href={config.playStoreUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span className="profile-menu-text">
                <span className="profile-menu-title">Rate us</span>
                <span className="profile-menu-sub">Leave a review on the store</span>
              </span>
              <span className="profile-menu-chevron" aria-hidden>
                ›
              </span>
            </a>
            <MenuLink to="/profile/about" title="About GoQuick" subtitle="App info and policies" />
            <MenuLink
              title={loggingOut ? "Signing out…" : "Log out"}
              danger
              onClick={() => setLogoutOpen(true)}
            />
          </nav>
        </div>
      </aside>

      <section className="profile-detail-panel">
        <Outlet />
      </section>

      {logoutOpen ? (
        <LogoutConfirmModal
          busy={loggingOut}
          onClose={() => {
            if (!loggingOut) setLogoutOpen(false);
          }}
          onConfirm={() => void confirmLogout()}
        />
      ) : null}
    </div>
  );
}

export function ProfileSelectEmpty() {
  return (
    <div className="profile-detail-empty">
      <div className="empty-notifications-icon" aria-hidden="true">
        👤
      </div>
      <h2>Select a setting</h2>
      <p className="muted">Choose an item from the menu to view or edit your account.</p>
    </div>
  );
}
