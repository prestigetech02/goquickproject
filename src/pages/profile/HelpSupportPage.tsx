import { Link } from "react-router-dom";
import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { config } from "../../lib/config";
import { usePublicSupportConfigQuery, useSupportTicketsUnreadCountQuery } from "../../lib/queries";
import { unreadCountLabel } from "../../types/supportTicket";

export function HelpSupportPage() {
  const publicConfig = usePublicSupportConfigQuery();
  const unreadQuery = useSupportTicketsUnreadCountQuery();
  const whatsAppUrl = publicConfig.data?.support_whatsapp_url || config.whatsAppUrl;
  const supportEmail = publicConfig.data?.support_email || config.supportEmail;
  const unread = unreadQuery.data ?? 0;
  const unreadLabel = unreadCountLabel(unread);

  return (
    <div className="page profile-page">
      <ProfileSubHeader title="Help & Support" />

      <nav className="card profile-menu" aria-label="Help">
        <a className="profile-menu-item" href={whatsAppUrl} target="_blank" rel="noreferrer">
          <span className="profile-menu-text">
            <span className="profile-menu-title">WhatsApp</span>
            <span className="profile-menu-sub">Chat with support on WhatsApp</span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </a>
        <Link
          to="/profile/help/tickets"
          className="profile-menu-item"
          aria-label={
            unread > 0
              ? `Support ticket, ${unread} unread ${unread === 1 ? "reply" : "replies"} from support`
              : undefined
          }
        >
          <span className="profile-menu-text">
            <span className="profile-menu-title">Support ticket</span>
            <span className="profile-menu-sub">Create or follow up on a ticket</span>
          </span>
          {unreadLabel ? (
            <span className="profile-menu-count" aria-hidden>
              {unreadLabel}
            </span>
          ) : null}
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </Link>
        <a className="profile-menu-item" href={`${config.landingUrl}/faq`} target="_blank" rel="noreferrer">
          <span className="profile-menu-text">
            <span className="profile-menu-title">FAQs</span>
            <span className="profile-menu-sub">Common questions about GoQuick</span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </a>
        <a className="profile-menu-item" href={`mailto:${supportEmail}`}>
          <span className="profile-menu-text">
            <span className="profile-menu-title">Email</span>
            <span className="profile-menu-sub">{supportEmail}</span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </a>
        <a
          className="profile-menu-item"
          href={`${config.landingUrl}/privacy`}
          target="_blank"
          rel="noreferrer"
        >
          <span className="profile-menu-text">
            <span className="profile-menu-title">Privacy Policy</span>
            <span className="profile-menu-sub">How we protect your data</span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </a>
        <a
          className="profile-menu-item"
          href={`${config.landingUrl}/terms`}
          target="_blank"
          rel="noreferrer"
        >
          <span className="profile-menu-text">
            <span className="profile-menu-title">Terms of Service</span>
            <span className="profile-menu-sub">Rules for using GoQuick</span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </a>
        <Link to="/profile/about" className="profile-menu-item">
          <span className="profile-menu-text">
            <span className="profile-menu-title">About GoQuick</span>
            <span className="profile-menu-sub">Product and company info</span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </Link>
      </nav>
    </div>
  );
}
