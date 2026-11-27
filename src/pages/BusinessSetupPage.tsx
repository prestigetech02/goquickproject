import { useState, type FormEvent } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { getStoredUser, setStoredUser } from "../lib/auth";
import { registerProfile } from "../lib/authApi";
import { clearSignupIntent } from "../lib/businessAuth";
import { getApiErrorMessage } from "../lib/http";
import { NIGERIAN_STATES } from "../lib/nigerianStates";
import {
  createOrganization,
  resubmitOrganizationKyb,
  type OrganizationKybResult,
} from "../lib/organizationApi";
import { queryClient, queryKeys } from "../lib/queryClient";
import { isProfileComplete, userOwnsBusiness, type User } from "../types/api";

type IdType = "nin" | "voters_card" | "passport" | "drivers_license";

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
  const [lga, setLga] = useState("");
  const [idType, setIdType] = useState<IdType>("nin");
  const [idNumber, setIdNumber] = useState("");
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [proofOfAddress, setProofOfAddress] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [kybError, setKybError] = useState<string | null>(null);
  const ownedOrg = existing?.organizations?.find((o) => o.role === "owner") ?? null;
  const kybOk =
    ownedOrg?.kyb_status === "identity_verified" || ownedOrg?.kyb_status === "verified";
  const needsKybRetry =
    Boolean(ownedOrg) &&
    !kybOk &&
    ["failed", "none", "submitted"].includes(String(ownedOrg?.kyb_status ?? "none"));
  const [retryOrgId, setRetryOrgId] = useState<number | null>(
    needsKybRetry && ownedOrg ? ownedOrg.id : null,
  );

  if (userOwnsBusiness(existing) && kybOk) {
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
    setKybError(null);

    if (!businessName.trim() && retryOrgId == null) {
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
    if ((!address.trim() || !city.trim() || !state.trim()) && retryOrgId == null) {
      toast.error("Business address, city, and state are required.");
      return;
    }
    if (!lga.trim()) {
      toast.error("Enter the LGA for your business address.");
      return;
    }
    if (!idNumber.trim()) {
      toast.error("Enter the director ID number.");
      return;
    }
    if (idType === "nin" && idNumber.replace(/\D/g, "").length !== 11) {
      toast.error("NIN must be 11 digits.");
      return;
    }
    if (!idDocument) {
      toast.error("Upload a clear photo/PDF of the director’s national ID.");
      return;
    }
    if (!proofOfAddress) {
      toast.error("Upload proof of business address (utility bill, lease, or bank letter).");
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

      const ownedFailed =
        retryOrgId ??
        existing?.organizations?.find(
          (o) => o.role === "owner" && (o.kyb_status === "failed" || o.kyb_status === "none"),
        )?.id ??
        null;

      const kybPayload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        lga: lga.trim(),
        director_id_type: idType,
        director_id_number: idNumber.trim(),
        director_id_document: idDocument,
        proof_of_address: proofOfAddress,
      };

      const orgRes = ownedFailed
        ? await resubmitOrganizationKyb(ownedFailed, kybPayload)
        : await createOrganization({
            name: businessName.trim(),
            cac_number: cacNumber.trim() || undefined,
            address: address.trim(),
            city: city.trim(),
            state: state.trim(),
            contact_email: email.trim().toLowerCase(),
            contact_phone: user.phone ?? undefined,
            ...kybPayload,
          });

      const org = orgRes.data?.organization;
      const orgs = orgRes.data?.organizations;
      const canProceed = Boolean(orgRes.data?.kyb?.can_proceed ?? orgRes.success);

      if (org || orgs) {
        const updated: User = {
          ...user,
          organizations: orgs ?? (org ? [org] : user.organizations),
          has_password: true,
        };
        setStoredUser(updated);
        queryClient.setQueryData(queryKeys.profile, updated);
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      }

      if (!canProceed) {
        const reason =
          orgRes.data?.kyb?.failure_reason ||
          orgRes.error?.message ||
          orgRes.message ||
          "QoreID could not verify your documents.";
        setKybError(reason);
        setRetryOrgId(org?.id ?? ownedFailed);
        setIdDocument(null);
        setProofOfAddress(null);
        toast.error(reason);
        return;
      }

      clearSignupIntent();
      toast.success(
        orgRes.message ||
          "Identity verified. Your business is pending GoQuick admin approval.",
      );
      navigate("/", { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const payload = err.response.data as {
          message?: string;
          error?: { message?: string; code?: string };
          data?: OrganizationKybResult;
        };
        const org = payload.data?.organization;
        const orgs = payload.data?.organizations;
        if (org || orgs) {
          const base = getStoredUser() ?? { id: 0, phone: null, role: "buyer" as const };
          const updated: User = {
            ...base,
            organizations: orgs ?? (org ? [org] : base.organizations),
          };
          setStoredUser(updated);
          queryClient.setQueryData(queryKeys.profile, updated);
        }
        const reason =
          payload.data?.kyb?.failure_reason ||
          payload.error?.message ||
          payload.message ||
          "QoreID could not verify your documents.";
        setKybError(reason);
        setRetryOrgId(org?.id ?? retryOrgId);
        setIdDocument(null);
        setProofOfAddress(null);
        toast.error(reason);
        return;
      }
      toast.error(getApiErrorMessage(err, "Could not finish business setup."));
    } finally {
      setLoading(false);
    }
  }

  const isRetry = retryOrgId != null || existing?.organizations?.some((o) => o.role === "owner" && o.kyb_status === "failed");

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
      <h1>{isRetry ? "Reupload KYB documents" : "Set up your business"}</h1>
      <p className="muted">
        {isRetry
          ? "QoreID could not verify your previous submission. Upload clearer documents and try again. Your business stays pending until GoQuick approves."
          : "Use this same account — no new phone number. We’ll verify the director’s ID and proof of address with QoreID before you continue. Admin approval is still required."}
      </p>

      {kybError ? (
        <p className="auth-error" role="alert">
          {kybError}
        </p>
      ) : null}

      <form onSubmit={(e) => void handleSubmit(e)} className="stack">
        {!isRetry ? (
          <>
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
          </>
        ) : null}

        <div className="auth-field">
          <label htmlFor="owner-first">Director / owner first name</label>
          <input
            id="owner-first"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="owner-last">Director / owner last name</label>
          <input
            id="owner-last"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        {!isRetry ? (
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
        ) : null}

        {!isRetry ? (
          <>
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
          </>
        ) : null}

        <div className="auth-field">
          <label htmlFor="biz-lga">LGA</label>
          <input
            id="biz-lga"
            value={lga}
            onChange={(e) => setLga(e.target.value)}
            placeholder="e.g. Ikeja"
            required
          />
        </div>

        <hr style={{ border: 0, borderTop: "1px solid #e2e8e3", margin: "4px 0" }} />
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          KYB verification (QoreID)
        </p>

        <div className="auth-field">
          <label htmlFor="id-type">Director ID type</label>
          <select
            id="id-type"
            value={idType}
            onChange={(e) => setIdType(e.target.value as IdType)}
            required
          >
            <option value="nin">National ID (NIN) — recommended</option>
            <option value="voters_card">Voter’s card</option>
            <option value="passport">International passport</option>
            <option value="drivers_license">Driver’s licence</option>
          </select>
        </div>

        <div className="auth-field">
          <label htmlFor="id-number">
            {idType === "nin" ? "NIN (11 digits)" : "ID number"}
          </label>
          <input
            id="id-number"
            value={idNumber}
            onChange={(e) =>
              setIdNumber(
                idType === "nin" ? e.target.value.replace(/\D/g, "").slice(0, 11) : e.target.value,
              )
            }
            placeholder={idType === "nin" ? "12345678901" : "As printed on the ID"}
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="id-doc">Director ID document (JPG, PNG, or PDF)</label>
          <input
            id="id-doc"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setIdDocument(e.target.files?.[0] ?? null)}
            required={!idDocument}
          />
          {idDocument ? (
            <span className="muted" style={{ fontSize: 12 }}>
              Selected: {idDocument.name}
            </span>
          ) : null}
        </div>

        <div className="auth-field">
          <label htmlFor="poa">Proof of business address</label>
          <input
            id="poa"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setProofOfAddress(e.target.files?.[0] ?? null)}
            required={!proofOfAddress}
          />
          {proofOfAddress ? (
            <span className="muted" style={{ fontSize: 12 }}>
              Selected: {proofOfAddress.name}
            </span>
          ) : null}
          <span className="muted" style={{ fontSize: 12 }}>
            Utility bill, lease, or bank letter showing the business address.
          </span>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading
            ? "Verifying with QoreID…"
            : isRetry
              ? "Reupload & verify"
              : "Create business & verify KYB"}
        </button>
      </form>
    </div>
  );
}
