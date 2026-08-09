import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PasswordInput } from "../components/PasswordInput";
import { getStoredUser, setStoredUser } from "../lib/auth";
import { setPassword as setPasswordApi } from "../lib/authApi";
import { getApiErrorMessage } from "../lib/http";
import type { User } from "../types/api";

export function SetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await setPasswordApi(password, confirmPassword);
      if (!res.success || !res.data?.user) {
        setError(res.error?.message || "Could not set password.");
        return;
      }

      const existing = getStoredUser();
      const updated: User = {
        ...(existing ?? { id: res.data.user.id, phone: null, role: "buyer" }),
        ...res.data.user,
        has_password: true,
      };
      setStoredUser(updated);

      if (updated.role === "runner") {
        navigate("/get-app", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, "Could not set password.");
      // Already set on server — continue into the app
      if (msg.toLowerCase().includes("already set")) {
        const existing = getStoredUser();
        if (existing) {
          setStoredUser({ ...existing, has_password: true });
        }
        navigate("/", { replace: true });
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/goquick.png" alt="GoQuick" className="auth-logo" />
        <h1>Create a password</h1>
        <p className="muted">
          Your phone is verified. Set a password so you can sign in next time.
        </p>

        <form onSubmit={handleSubmit} className="stack">
          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <PasswordInput
            id="confirmPassword"
            label="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Saving…" : "Continue to dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
