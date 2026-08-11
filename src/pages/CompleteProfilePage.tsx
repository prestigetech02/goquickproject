import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { getStoredUser, setStoredUser } from "../lib/auth";
import { registerProfile } from "../lib/authApi";
import { getApiErrorMessage } from "../lib/http";
import { NIGERIAN_STATES } from "../lib/nigerianStates";
import { uploadProfilePicture } from "../lib/profileApi";
import { queryClient, queryKeys } from "../lib/queryClient";
import type { User } from "../types/api";

function initials(first?: string | null, last?: string | null): string {
  const a = first?.trim()?.[0] ?? "";
  const b = last?.trim()?.[0] ?? "";
  const value = `${a}${b}`.toUpperCase();
  return value || "?";
}

export function CompleteProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const existing = getStoredUser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(existing?.first_name ?? "");
  const [lastName, setLastName] = useState(existing?.last_name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [state, setState] = useState(existing?.state ?? "");
  const [referralCode, setReferralCode] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    existing?.profile_picture ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  function handleAvatarPick(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be 2MB or smaller.");
      return;
    }
    if (avatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name are required.");
      return;
    }
    if (!email.trim()) {
      toast.error("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (!address.trim() || !city.trim() || !state.trim()) {
      toast.error("Address, city, and state are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await registerProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        referral_code: referralCode.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error?.message || "Failed to save profile.");
        return;
      }

      let pictureUrl = res.data?.user?.profile_picture ?? existing?.profile_picture ?? null;

      if (avatarFile) {
        try {
          setUploadProgress(0);
          const picRes = await uploadProfilePicture(avatarFile, (percent) =>
            setUploadProgress(percent),
          );
          if (picRes.success && picRes.data?.profile_picture) {
            pictureUrl = picRes.data.profile_picture;
          }
        } catch (picErr) {
          toast.error(
            getApiErrorMessage(
              picErr,
              "Profile saved, but photo upload failed. You can add it later from Profile.",
            ),
          );
        } finally {
          setUploadProgress(null);
        }
      }

      const updated: User = {
        ...(existing ?? { id: 0, phone: null, role: "buyer" }),
        ...(res.data?.user ?? {}),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        role: "buyer",
        profile_picture: pictureUrl,
        has_password: true,
      };
      setStoredUser(updated);
      queryClient.setQueryData(queryKeys.profile, updated);
      toast.success("Profile saved.");

      navigate("/", { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save profile."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card auth-card-wide">
      <img src="/goquick.png" alt="GoQuick" className="auth-logo" />
      <h1>Complete your profile</h1>
      <p className="muted">
        Add a few details so you can post errands and pay securely. You can browse the
        dashboard meanwhile.
      </p>

      <form onSubmit={handleSubmit} className="stack">
        <div className="complete-avatar-block">
          <button
            type="button"
            className="profile-avatar-btn complete-avatar-btn"
            onClick={() => fileRef.current?.click()}
            disabled={loading || uploadProgress != null}
            aria-label="Upload profile photo"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="profile-avatar-img" />
            ) : (
              <span className="profile-avatar-fallback">
                {initials(firstName, lastName)}
              </span>
            )}
            <span className="profile-avatar-badge" aria-hidden>
              {uploadProgress != null ? "…" : "✎"}
            </span>
          </button>
          <div className="complete-avatar-copy">
            <div className="complete-avatar-text">
              <p className="complete-avatar-title">Profile photo</p>
              <p className="complete-avatar-hint">Optional · JPG, PNG or WebP · max 2MB</p>
            </div>
            {uploadProgress != null ? (
              <p className="complete-avatar-status">Uploading… {uploadProgress}%</p>
            ) : (
              <button
                type="button"
                className="complete-avatar-pick"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
              >
                {avatarPreview ? "Change photo" : "Upload photo"}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              handleAvatarPick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

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

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
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

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Saving…" : "Save and continue"}
        </button>

        <button type="button" className="btn-ghost" onClick={() => navigate("/")}>
          Skip for now
        </button>
      </form>
    </div>
  );
}
