import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PasswordInput } from "../components/PasswordInput";
import { useToast } from "../components/ToastProvider";
import { confirmPasswordReset, sendPasswordReset } from "../lib/authApi";
import { getApiErrorMessage } from "../lib/http";

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("234")) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

type Step = "phone" | "reset";

export function ForgotPasswordPage() {
  const toast = useToast();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const normalized = normalizePhone(phone);
    if (!/^\d{11}$/.test(normalized)) {
      toast.error("Enter a valid 11-digit Nigerian phone number.");
      setLoading(false);
      return;
    }
    try {
      await sendPasswordReset(normalized);
      setPhone(normalized);
      setStep("reset");
      toast.success("Reset code sent to your phone.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not send reset code."));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      setLoading(false);
      return;
    }
    try {
      await confirmPasswordReset({
        phone,
        otp: otp.trim(),
        password,
        password_confirmation: confirm,
      });
      setDone(true);
      toast.success("Password updated. You can sign in now.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not reset password."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <img src="/goquick.png" alt="GoQuick" className="auth-logo" />
      <h1>Reset password</h1>

      {done ? (
        <>
          <p className="muted">Your password has been updated.</p>
          <Link to="/login" className="btn-primary">
            Back to sign in
          </Link>
        </>
      ) : step === "phone" ? (
        <>
          <p className="muted">We’ll send a code to your phone.</p>
          <form onSubmit={handleSend} className="stack">
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08012345678"
              required
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="muted">Enter the code and your new password.</p>
          <form onSubmit={handleReset} className="stack">
            <label htmlFor="otp">OTP</label>
            <input
              id="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={5}
              required
            />
            <PasswordInput
              id="password"
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <PasswordInput
              id="confirm"
              label="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving…" : "Update password"}
            </button>
          </form>
        </>
      )}

      <p className="auth-footer-text">
        <Link to="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
