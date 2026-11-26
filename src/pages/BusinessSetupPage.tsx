import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { getStoredUser, setStoredUser } from "../lib/auth";
import { registerProfile } from "../lib/authApi";
import { clearSignupIntent } from "../lib/businessAuth";
import { getApiErrorMessage } from "../lib/http";
import { NIGERIAN_STATES } from "../lib/nigerianStates";
import { createOrganization } from "../lib/organizationApi";
import { queryClient, queryKeys } from "../lib/queryClient";
import { isProfileComplete, userOwnsBusiness, type User } from "../types/api";

export function BusinessSetupPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const existing = getStoredUser();

  const [businessName, setBusinessName] = useState("");
  const [cacNumber, setCacNumber] = useState("");
  const [firstName, setFirstName] = useState(existing?.first_name ?? "");
  const [lastName, setLastName] = useState(existing?.last_name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [state, setState] = useState(existing?.state ?? "");
  const [loading, setLoading] = useState(false);

  if (userOwnsBusiness(existing)) {
    clearSignupIntent();
    navigate("/", { replace: true });
    return null;
  }

  function handleClose() {
    clearSignupIntent();
    navigate("/profile", { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!businessName.trim()) {
      toast.error("Enter your business name.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Owner first and last name are required.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (!address.trim() || !city.trim() || !state.trim()) {
      toast.error("Business address, city, and state are required.");
      return;
    }

    setLoading(true);
    try {
      let user: User = existing ?? { id: 0, phone: null, role: "buyer" };

      if (!isProfileComplete(existing)) {
        const profileRes = await registerProfile({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
        });
        if (!profileRes.success || !profileRes.data?.user) {
          toast.error(profileRes.error?.message || "Could not save your profile.");
          return;
        }
        user = {
          ...user,
          ...profileRes.data.user,
          has_password: true,
        };
      }

      const orgRes = await createOrganization({
        name: businessName.trim(),
        cac_number: cacNumber.trim() || undefined,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        contact_email: email.trim().toLowerCase(),
        contact_phone: user.phone ?? undefined,
      });

      if (!orgRes.success) {
        toast.error(orgRes.error?.message || "Could not register your business.");
        return;
      }

      const updated: User = {
        ...user,
        organizations: orgRes.data?.organizations ?? (orgRes.data?.organization ? [orgRes.data.organization] : []),
        has_password: true,
      };
      setStoredUser(updated);
      queryClient.setQueryData(queryKeys.profile, updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      clearSignupIntent();

      toast.success("Business registered. You’re signed in as the owner.");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not finish business setup."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card auth-card-dismissible">
      <button
        type="button"
        className="auth-card-close"
        onClick={handleClose}
        disabled={loading}
        aria-label="Close"
      >
        ×
      </button>
      <img src="/goquick.png" alt="GoQuick" className="auth-logo" />
      <h1>Set up your business</h1>
      <p className="muted">
        Use this same account — no new phone number. You’ll be the owner; branches can be added when
        posting jobs later.
      </p>

      <form onSubmit={handleSubmit} className="stack">
        <div className="auth-field">
          <label htmlFor="business-name">Business name</label>
          <input
            id="business-name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. HealthPlus Lekki"
            required
            maxLength={160}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="cac">
            CAC number <span className="muted">(optional)</span>
          </label>
          <input
            id="cac"
            value={cacNumber}
            onChange={(e) => setCacNumber(e.target.value)}
            placeholder="RC or BN number"
            maxLength={40}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="owner-first">Owner first name</label>
          <input
            id="owner-first"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="owner-last">Owner last name</label>
          <input
            id="owner-last"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="owner-email">Work email</label>
          <input
            id="owner-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="biz-address">Business address</label>
          <input
            id="biz-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="biz-city">City</label>
          <input id="biz-city" value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>

        <div className="auth-field">
          <label htmlFor="biz-state">State</label>
          <select id="biz-state" value={state} onChange={(e) => setState(e.target.value)} required>
            <option value="">Select state</option>
            {NIGERIAN_STATES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Saving…" : "Create business account"}
        </button>
      </form>
    </div>
  );
}
