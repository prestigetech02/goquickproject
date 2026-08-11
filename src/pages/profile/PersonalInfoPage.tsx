import { useEffect, useState, type FormEvent } from "react";
import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { useToast } from "../../components/ToastProvider";
import { getApiErrorMessage } from "../../lib/http";
import { NIGERIAN_STATES } from "../../lib/nigerianStates";
import { useProfileQuery, useUpdateProfileMutation } from "../../lib/queries";

export function PersonalInfoPage() {
  const toast = useToast();
  const { data: user, isPending } = useProfileQuery();
  const update = useUpdateProfileMutation();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    if (!user) return;
    setFirstName(user.first_name ?? "");
    setLastName(user.last_name ?? "");
    setEmail(user.email ?? "");
    setAddress(user.address ?? "");
    setCity(user.city ?? "");
    setState(user.state ?? "");
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name are required.");
      return;
    }
    if (!address.trim() || !city.trim() || !state.trim()) {
      toast.error("Address, city, and state are required.");
      return;
    }

    try {
      await update.mutateAsync({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
      });
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save profile."));
    }
  }

  return (
    <div className="page profile-page">
      <ProfileSubHeader title="My Profile" />

      {isPending && !user ? <p className="muted">Loading…</p> : null}

      <form onSubmit={handleSubmit} className="card stack profile-form">
        <label htmlFor="pi-first">First name</label>
        <input
          id="pi-first"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          autoComplete="given-name"
          required
        />

        <label htmlFor="pi-last">Last name</label>
        <input
          id="pi-last"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          autoComplete="family-name"
          required
        />

        <label htmlFor="pi-phone">Phone</label>
        <input id="pi-phone" value={user?.phone ?? ""} disabled readOnly />
        <p className="field-hint muted">Phone is managed from Account &amp; Security on mobile.</p>

        <label htmlFor="pi-email">Email</label>
        <input
          id="pi-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <label htmlFor="pi-address">Address</label>
        <input
          id="pi-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="street-address"
          required
        />

        <label htmlFor="pi-city">City</label>
        <input
          id="pi-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          autoComplete="address-level2"
          required
        />

        <label htmlFor="pi-state">State</label>
        <select
          id="pi-state"
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

        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
