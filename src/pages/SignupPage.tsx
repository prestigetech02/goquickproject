import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
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
  const toast = useToast();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    const normalized = normalizePhone(phone);
    if (!/^\d{11}$/.test(normalized)) {
      toast.error("Enter a valid 11-digit Nigerian phone number.");
      setLoading(false);
      return;
    }
    if (!acceptedTerms) {
      toast.error("Please accept the Terms of Service and Privacy Policy.");
      setLoading(false);
      return;
    }

    try {
      await sendOtp(normalized);
      setPhone(normalized);
      setStep("otp");
      toast.success("We sent a 6-digit code to your phone.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not send OTP."));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await verifyOtp(phone, otp.trim());
      if (!res.success || !res.data?.token) {
        toast.error(res.error?.message || "Invalid OTP.");
        return;
      }

      establishSession(res.data.token, {
        ...res.data.user,
        has_password: res.data.user.has_password === true,
      });

      toast.success("Phone verified.");

      if (res.data.user.has_password !== true) {
        navigate("/set-password", { replace: true });
      } else if (res.data.user.role === "runner") {
        navigate("/get-app", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not verify OTP."));
    } finally {
      setLoading(false);
    }
  }

  return (
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
            maxLength={6}
            placeholder="12345"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Verifying…" : "Verify & continue"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setStep("phone");
              setOtp("");
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
  );
}
