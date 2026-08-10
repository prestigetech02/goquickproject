import { Outlet, useLocation } from "react-router-dom";
import authPanelArt from "../assets/auth-panel.png";

const SCROLL_FORM_PATHS = new Set(["/complete-profile"]);

/** Persistent auth chrome: green panel stays mounted while forms switch via <Outlet />. */
export function AuthLayout() {
  const { pathname } = useLocation();
  const formClassName = SCROLL_FORM_PATHS.has(pathname) ? "auth-shell-form-scroll" : "";

  return (
    <div className="auth-shell">
      <div className={`auth-shell-form ${formClassName}`.trim()}>
        <div className="auth-shell-form-inner">
          <Outlet />
        </div>
      </div>

      <aside className="auth-shell-panel" aria-hidden="true">
        <div className="auth-shell-panel-bg" />
        <div className="auth-shell-orb auth-shell-orb-a" />
        <div className="auth-shell-orb auth-shell-orb-b" />
        <div className="auth-shell-orb auth-shell-orb-c" />
        <div className="auth-shell-grid" />

        <div className="auth-shell-panel-content">
          <img src="/goquick-white.png" alt="" className="auth-shell-brand" />
          <h2 className="auth-shell-title">Errands done, without leaving home.</h2>
          <div className="auth-shell-art-wrap">
            <img src={authPanelArt} alt="" className="auth-shell-art" />
          </div>
        </div>
      </aside>
    </div>
  );
}
