import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { establishSession } from "../lib/auth";
import { sendOtp, verifyOtp } from "../lib/authApi";
import { config } from "../lib/config";
import { getApiErrorMessage } from "../lib/http";

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("234")) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

type Step = "phone" | "otp";

export function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const normalized = normalizePhone(phone);
    if (!/^\d{11}$/.test(normalized)) {
      setError("Enter a valid 11-digit Nigerian phone number.");
      setLoading(false);
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy.");
      setLoading(false);
      return;
    }

    try {
      await sendOtp(normalized);
      setPhone(normalized);
      setStep("otp");
      setInfo("We sent a 5-digit code to your phone.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not send OTP."));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await verifyOtp(phone, otp.trim());
      if (!res.success || !res.data?.token) {
        setError(res.error?.message || "Invalid OTP.");
        return;
      }

      establishSession(res.data.token, {
        ...res.data.user,
        has_password: res.data.user.has_password === true,
      });

      if (res.data.user.has_password !== true) {
        navigate("/set-password", { replace: true });
      } else if (res.data.user.role === "runner") {
        navigate("/get-app", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not verify OTP."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/goquick.png" alt="GoQuick" className="auth-logo" />
        <h1>Create account</h1>
        <p className="muted">
          {step === "phone"
            ? "Verify your phone to get started as a requester."
            : `Enter the code sent to ${phone}.`}
        </p>

        {step === "phone" ? (
          <form onSubmit={handleSendOtp} className="stack">
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="08012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />

            <label className="checkbox-label terms-label" htmlFor="accept-terms">
              <input
                id="accept-terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>
                I agree to the{" "}
                <a href={`${config.landingUrl}/terms`} target="_blank" rel="noreferrer">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href={`${config.landingUrl}/privacy`} target="_blank" rel="noreferrer">
                  Privacy Policy
                </a>
              </span>
            </label>

            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="stack">
            <label htmlFor="otp">OTP code</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="12345"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
            {info ? <p className="info">{info}</p> : null}
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Verifying…" : "Verify & continue"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError(null);
                setInfo(null);
              }}
            >
              Change number
            </button>
          </form>
        )}

        <p className="auth-footer-text">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
