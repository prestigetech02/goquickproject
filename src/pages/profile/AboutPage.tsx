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
        <div className="profile-kv">
          <span className="muted">Android</span>
          <a href={config.playStoreUrl} target="_blank" rel="noreferrer">
            Google Play
          </a>
        </div>
        <div className="profile-kv">
          <span className="muted">iOS</span>
          <a href={config.appStoreUrl} target="_blank" rel="noreferrer">
            App Store
          </a>
        </div>

        <p className="muted" style={{ fontSize: "0.85rem", marginTop: 8 }}>
          © {new Date().getFullYear()} GoQuick. All rights reserved.
        </p>
      </section>
    </div>
  );
}
