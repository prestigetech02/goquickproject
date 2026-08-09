import { Link } from "react-router-dom";
import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { config } from "../../lib/config";

export function HelpSupportPage() {
  return (
    <div className="page profile-page">
      <ProfileSubHeader title="Help & Support" />

      <nav className="card profile-menu" aria-label="Help">
        <a className="profile-menu-item" href={`${config.landingUrl}/faq`} target="_blank" rel="noreferrer">
          <span className="profile-menu-text">
            <span className="profile-menu-title">FAQs</span>
            <span className="profile-menu-sub">Common questions about GoQuick</span>
          </span>
          <span className="profile-menu-chevron" aria-hidden>
            ›
          </span>
        </a>
        <a className="profile-menu-item" href="mailto:support@goquickapp.com.ng">
          <span className="profile-menu-text">
            <span className="profile-menu-title">Contact Support</span>
            <span className="profile-menu-sub">support@goquickapp.com.ng</span>
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
