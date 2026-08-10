import { Link } from "react-router-dom";
import { config } from "../lib/config";
import { clearSession } from "../lib/auth";

/** Shown when a runner signs in on web — runners stay on the mobile app for MVP. */
export function GetAppPage() {
  return (
    <div className="auth-card">
      <img src="/goquick.png" alt="GoQuick" className="auth-logo" />
      <h1>Get the GoQuick app</h1>
      <p className="muted">
        Runner tools (jobs, live location, and KYC) work best in the mobile app. Download
        GoQuick to go online and earn.
      </p>

      <div className="stack">
        <a className="btn-primary" href={config.playStoreUrl} target="_blank" rel="noreferrer">
          Download on Google Play
        </a>
        <a className="btn-secondary" href={config.appStoreUrl} target="_blank" rel="noreferrer">
          Download on the App Store
        </a>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            clearSession();
            window.location.href = "/login";
          }}
        >
          Sign out
        </button>
      </div>

      <p className="auth-footer-text">
        Looking to post an errand?{" "}
        <Link
          to="/login"
          onClick={() => clearSession()}
        >
          Sign in as a requester
        </Link>
      </p>
    </div>
  );
}
