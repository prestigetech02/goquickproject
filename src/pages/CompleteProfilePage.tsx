import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getStoredUser, setStoredUser } from "../lib/auth";
import { registerProfile } from "../lib/authApi";
import { getApiErrorMessage } from "../lib/http";
import { NIGERIAN_STATES } from "../lib/nigerianStates";
import type { User } from "../types/api";

type RoleChoice = "buyer" | "runner";

export function CompleteProfilePage() {
  const navigate = useNavigate();
  const existing = getStoredUser();

  const [role, setRole] = useState<RoleChoice>(
    existing?.role === "runner" ? "runner" : "buyer",
  );
  const [firstName, setFirstName] = useState(existing?.first_name ?? "");
  const [lastName, setLastName] = useState(existing?.last_name ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [state, setState] = useState(existing?.state ?? "");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!address.trim() || !city.trim() || !state.trim()) {
      setError("Address, city, and state are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await registerProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        role,
        referral_code: referralCode.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error?.message || "Failed to save profile.");
        return;
      }

      const updated: User = {
        ...(existing ?? { id: 0, phone: null, role }),
        ...(res.data?.user ?? {}),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        role,
        has_password: true,
      };
      setStoredUser(updated);

      if (role === "runner") {
        navigate("/get-app", { replace: true });
        return;
      }

      navigate("/", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save profile."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page auth-page-scroll">
      <div className="auth-card auth-card-wide">
        <img src="/goquick.png" alt="GoQuick" className="auth-logo" />
        <h1>Complete your profile</h1>
        <p className="muted">
          Add a few details so you can post errands and pay securely. You can browse the
          dashboard meanwhile.
        </p>

        <form onSubmit={handleSubmit} className="stack">
          <p className="field-group-label">I am here to</p>
          <div className="role-grid">
            <button
              type="button"
              className={`role-card${role === "buyer" ? " selected" : ""}`}
              onClick={() => setRole("buyer")}
            >
              <span className="role-title">Request Errand</span>
              <span className="role-desc">Post tasks for runners</span>
            </button>
            <button
              type="button"
              className={`role-card${role === "runner" ? " selected" : ""}`}
              onClick={() => setRole("runner")}
            >
              <span className="role-title">Run Errand</span>
              <span className="role-desc">Earn on the mobile app</span>
            </button>
          </div>

          {role === "runner" ? (
            <p className="info">
              Runner tools work best in the GoQuick mobile app. After saving, we&apos;ll send you to
              download the app for KYC.
            </p>
          ) : null}

          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoComplete="given-name"
          />

          <label htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            autoComplete="family-name"
          />

          <label htmlFor="address">Address</label>
          <input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            autoComplete="street-address"
          />

          <label htmlFor="city">City</label>
          <input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            autoComplete="address-level2"
          />

          <label htmlFor="state">State</label>
          <select
            id="state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            required
          >
            <option value="">Select state</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <label htmlFor="referral">Referral code (optional)</label>
          <input
            id="referral"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder="Enter referral code if you have one"
            autoComplete="off"
          />

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Saving…" : "Save and continue"}
          </button>

          <button type="button" className="btn-ghost" onClick={() => navigate("/")}>
            Skip for now
          </button>
        </form>
      </div>
    </div>
  );
}
