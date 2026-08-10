import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export function AccountSuccessPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate("/login", { replace: true });
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="auth-card success-card">
      <div className="success-icon" aria-hidden="true">
        ✓
      </div>
      <h1>Account created!</h1>
      <p className="muted">
        Your account has been successfully created. Redirecting to login…
      </p>
      <Link to="/login" className="btn-primary" replace>
        Continue to login
      </Link>
    </div>
  );
}
