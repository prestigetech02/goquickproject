import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { getStoredUser } from "../lib/auth";
import { useChatThreadsQuery, useProfileQuery, useUnreadNotificationCountQuery } from "../lib/queries";
import { useUserRealtime } from "../lib/useUserRealtime";

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconErrands() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChats() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12a8 8 0 01-8 8H7l-4 3V12a8 8 0 018-8h2a8 8 0 018 8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19.5c1.5-3.5 4-5 7-5s5.5 1.5 7 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9a6 6 0 0112 0c0 7 3 7 3 9H3c0-2 3-2 3-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 20a2 2 0 004 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

type NavItemProps = {
  to: string;
  end?: boolean;
  label: string;
  icon: ReactNode;
  badge?: number;
};

function NavItem({ to, end, label, icon, badge = 0 }: NavItemProps) {
  const badgeLabel = badge > 99 ? "99+" : String(badge);
  return (
    <NavLink
      to={to}
      end={end}
      className="nav-item"
      aria-label={badge > 0 ? `${label}, ${badge} unread` : label}
    >
      <span className="nav-icon-wrap">
        <span className="nav-icon">{icon}</span>
        {badge > 0 ? <span className="nav-badge">{badgeLabel}</span> : null}
      </span>
      <span className="nav-label">{label}</span>
    </NavLink>
  );
}

function Avatar({ name, picture }: { name: string; picture?: string | null }) {
  const initial = (name.trim()[0] || "G").toUpperCase();
  if (picture) {
    return <img src={picture} alt="" className="header-avatar-img" />;
  }
  return <span className="header-avatar-fallback">{initial}</span>;
}

export function AppLayout() {
  const stored = getStoredUser();
  const { data: profile } = useProfileQuery();
  const user = profile ?? stored;
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Requester";
  const { data: unreadCount = 0, refetch } = useUnreadNotificationCountQuery();
  const { unreadTotal: chatUnread = 0, refetch: refetchChats } = useChatThreadsQuery();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const { live: notificationsLive } = useUserRealtime();

  // Soft poll while shell is mounted; remounts reuse cache (no refetch on navigate).
  // When user-channel realtime is live, poll less often.
  useEffect(() => {
    const id = window.setInterval(
      () => {
        void refetch();
        void refetchChats();
      },
      notificationsLive ? 60_000 : 30_000,
    );
    return () => window.clearInterval(id);
  }, [refetch, refetchChats, notificationsLive]);

  // Mobile keyboards shrink the visual viewport and lift position:fixed bottom bars
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOpen(inset > 120);
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className={`app-shell${keyboardOpen ? " hide-bottom-nav" : ""}`}>
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to="/" className="brand">
            <img src="/goquick.png" alt="GoQuick" className="brand-logo" />
          </NavLink>
          <div className="app-header-actions">
            <NavLink
              to="/notifications"
              className="header-icon-btn"
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              title="Notifications"
            >
              <IconBell />
              {unreadCount > 0 ? (
                <span className="notification-badge">{badgeLabel}</span>
              ) : null}
            </NavLink>
            <NavLink
              to="/profile"
              className="header-avatar"
              aria-label="Profile"
              title={displayName}
            >
              <Avatar name={displayName} picture={user?.profile_picture} />
            </NavLink>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav
        className="bottom-nav"
        aria-label="Primary"
        hidden={keyboardOpen}
        aria-hidden={keyboardOpen}
      >
        <NavItem to="/" end label="Dashboard" icon={<IconHome />} />
        <NavItem to="/errands" label="My errands" icon={<IconErrands />} />
        <NavItem to="/chats" label="Chats" icon={<IconChats />} badge={chatUnread} />
        <NavItem to="/profile" label="Profile" icon={<IconProfile />} />
      </nav>
    </div>
  );
}
