import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordInput } from "../components/PasswordInput";
import { establishSession, getRememberMe } from "../lib/auth";
import { loginWithPhone } from "../lib/authApi";
import { getApiErrorMessage } from "../lib/http";

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("234")) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => getRememberMe());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const normalized = normalizePhone(phone);
    if (!/^\d{11}$/.test(normalized)) {
      setError("Enter a valid 11-digit Nigerian phone number.");
      setLoading(false);
      return;
    }

    try {
      const res = await loginWithPhone(normalized, password);
      if (!res.success || !res.data?.token) {
        setError(res.error?.message || "Login failed.");
        return;
      }

      establishSession(
        res.data.token,
        {
          ...res.data.user,
          has_password: res.data.user.has_password ?? true,
        },
        rememberMe,
      );

      if (res.data.user.role === "runner") {
        navigate("/get-app", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Login failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <img src="/goquick.png" alt="GoQuick" className="auth-logo" />
      <h1>Welcome back</h1>
      <p className="muted">Sign in to post and manage your errands.</p>

      <form onSubmit={handleSubmit} className="stack">
        <label htmlFor="phone">Phone number</label>
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          placeholder="08012345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          autoComplete="tel"
        />

        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <div className="row-between auth-options">
          <label className="checkbox-label" htmlFor="remember-me">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="link">
            Forgot password?
          </Link>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="auth-footer-text">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </div>
  );
}
