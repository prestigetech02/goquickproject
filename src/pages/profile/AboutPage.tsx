import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { config } from "../../lib/config";

export function AboutPage() {
  return (
    <div className="page profile-page">
      <ProfileSubHeader title="About GoQuick" />

      <section className="card stack profile-about">
        <img src="/goquick.png" alt="GoQuick" className="profile-about-logo" />
        <p className="muted" style={{ textAlign: "center" }}>
          Errands made simple — request a runner, track progress, and pay securely.
        </p>

        <div className="profile-kv">
          <span className="muted">Website</span>
          <a href={config.landingUrl} target="_blank" rel="noreferrer">
            {config.landingUrl.replace(/^https?:\/\//, "")}
          </a>
        </div>
        <div className="profile-kv">
          <span className="muted">Support</span>
          <a href="mailto:support@goquickapp.com.ng">support@goquickapp.com.ng</a>
        </div>

        <p className="muted" style={{ fontSize: "0.85rem", marginTop: 8 }}>
          © {new Date().getFullYear()} GoQuick. All rights reserved.
        </p>
      </section>

      <nav className="card profile-menu" aria-label="Legal">
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
      </nav>
    </div>
  );
}
