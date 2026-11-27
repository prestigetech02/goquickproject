import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { useToast } from "../../components/ToastProvider";
import { getStoredUser } from "../../lib/auth";
import { getApiErrorMessage } from "../../lib/http";
import {
  createOrganizationApiKey,
  fetchOrganizationApiKeys,
  fetchOrganizationWebhook,
  fetchOrganizationWebhookDeliveries,
  revokeOrganizationApiKey,
  updateOrganizationApiKey,
  upsertOrganizationWebhook,
  type OrganizationApiKey,
  type OrganizationWebhookDelivery,
  type OrganizationWebhookEndpoint,
} from "../../lib/organizationApi";
import { useProfileQuery } from "../../lib/queries";
import { userOwnsBusiness } from "../../types/api";

export function BusinessPartnerApiPage() {
  const toast = useToast();
  const stored = getStoredUser();
  const { data: profile } = useProfileQuery();
  const user = profile ?? stored;
  const owned = (user?.organizations ?? []).find((o) => o.role === "owner") ?? null;

  const [keys, setKeys] = useState<OrganizationApiKey[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Production");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [allowedIps, setAllowedIps] = useState("");
  const [editingIpKeyId, setEditingIpKeyId] = useState<number | null>(null);
  const [editingIps, setEditingIps] = useState("");
  const [saving, setSaving] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEndpoint, setWebhookEndpoint] = useState<OrganizationWebhookEndpoint | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [deliveries, setDeliveries] = useState<OrganizationWebhookDelivery[]>([]);

  useEffect(() => {
    if (!owned) return;
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetchOrganizationApiKeys(owned.id),
      fetchOrganizationWebhook(owned.id),
      fetchOrganizationWebhookDeliveries(owned.id, { page: 1, per_page: 10 }),
    ])
      .then(([keysRes, webhookRes, deliveriesRes]) => {
        if (cancelled) return;
        if (keysRes.success && keysRes.data) {
          setKeys(keysRes.data.keys);
          setEnabled(Boolean(keysRes.data.partner_api_enabled));
        } else {
          toast.error(keysRes.error?.message ?? "Could not load API keys.");
        }
        if (webhookRes.success && webhookRes.data) {
          setEnabled((prev) => prev || Boolean(webhookRes.data?.partner_api_enabled));
          setWebhookEndpoint(webhookRes.data.endpoint);
          if (webhookRes.data.endpoint?.url) setWebhookUrl(webhookRes.data.endpoint.url);
        }
        if (deliveriesRes.success && deliveriesRes.data) {
          setDeliveries(deliveriesRes.data.deliveries);
        }
      })
      .catch((err) => {
        if (!cancelled) toast.error(getApiErrorMessage(err, "Could not load Partner API settings."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // toast is memoized in useToast(); owned.id is the only load trigger we need.
  }, [owned?.id, toast]);

  if (!userOwnsBusiness(user) || !owned) {
    return <Navigate to="/profile" replace />;
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!owned) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give this key a name.");
      return;
    }
    setSaving(true);
    try {
      const res = await createOrganizationApiKey(owned.id, {
        name: trimmed,
        environment,
        allowed_ips: allowedIps.trim() || undefined,
      });
      if (!res.success || !res.data?.token || !res.data.key) {
        toast.error(res.error?.message ?? "Could not create API key.");
        return;
      }
      setFreshToken(res.data.token);
      setAllowedIps("");
      setKeys((prev) => [res.data!.key, ...prev]);
      setEnabled(true);
      toast.success("API key created. Copy it now — it won’t be shown again.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not create API key."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(key: OrganizationApiKey) {
    if (!owned || !key.is_active) return;
    if (!window.confirm(`Revoke ${key.masked_key}? Integrations using this key will stop working.`)) {
      return;
    }
    try {
      const res = await revokeOrganizationApiKey(owned.id, key.id);
      if (!res.success || !res.data?.key) {
        toast.error(res.error?.message ?? "Could not revoke key.");
        return;
      }
      setKeys((prev) => prev.map((k) => (k.id === key.id ? res.data!.key : k)));
      toast.success("API key revoked.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not revoke key."));
    }
  }

  async function copyToken() {
    if (!freshToken) return;
    try {
      await navigator.clipboard.writeText(freshToken);
      toast.success("Token copied.");
    } catch {
      toast.error("Could not copy. Select the token and copy manually.");
    }
  }

  return (
    <div className="page profile-page">
      <ProfileSubHeader title="Partner API" />

      <p className="muted">
        API keys and webhooks for <strong>{owned.name}</strong>. Docs cover endpoints and signatures.
      </p>

      {loading ? <p className="muted">Loading…</p> : null}

      {!loading && !enabled ? (
        <div className="card stack">
          <h2 className="profile-card-title">API not enabled yet</h2>
          <p className="muted" style={{ margin: 0 }}>
            Contact GoQuick to enable Partner API, then you can create keys here.
          </p>
        </div>
      ) : null}

      {!loading && enabled ? (
        <>
          {freshToken ? (
            <div className="card stack">
              <h2 className="profile-card-title">New key — copy now</h2>
              <p className="muted" style={{ margin: 0 }}>
                Shown once. Store it securely — it won’t appear again.
              </p>
              <code style={{ display: "block", wordBreak: "break-all", fontSize: 12 }}>{freshToken}</code>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn-primary" onClick={() => void copyToken()}>
                  Copy token
                </button>
                <button type="button" className="btn-ghost" onClick={() => setFreshToken(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <form className="card stack" onSubmit={(e) => void handleCreate(e)}>
            <h2 className="profile-card-title">Create API key</h2>
            <label className="stack">
              <span className="muted">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production" />
            </label>
            <label className="stack">
              <span className="muted">Environment</span>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as "live" | "test")}
              >
                <option value="live">Live (gq_live_)</option>
                <option value="test">Sandbox (gq_test_)</option>
              </select>
            </label>
            <label className="stack">
              <span className="muted">IP allowlist (optional)</span>
              <input
                value={allowedIps}
                onChange={(e) => setAllowedIps(e.target.value)}
                placeholder="1.2.3.4, 10.0.0.0/8 — empty = any IP"
              />
            </label>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Sandbox keys (<code>gq_test_</code>) don’t debit your live wallet.
            </p>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create key"}
            </button>
          </form>
        </>
      ) : null}

      {!loading ? (
        <ul className="saved-places-list">
          {keys.length === 0 ? (
            <li className="muted" style={{ listStyle: "none" }}>
              No keys yet.
            </li>
          ) : (
            keys.map((key) => (
              <li key={key.id} className="card saved-place-row">
                <div>
                  <strong>
                    {key.name}{" "}
                    <span className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>
                      {key.environment}
                    </span>
                  </strong>
                  <p className="muted" style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: 12 }}>
                    {key.masked_key}
                  </p>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                    {key.is_active ? "Active" : "Revoked"}
                    {key.ip_allowlist_enabled
                      ? ` · IPs: ${(key.allowed_ips ?? []).join(", ")}`
                      : " · IPs: any"}
                    {key.last_used_at
                      ? ` · Last used ${new Date(key.last_used_at).toLocaleString()}`
                      : ""}
                  </p>
                  {editingIpKeyId === key.id ? (
                    <div className="stack" style={{ marginTop: 8 }}>
                      <input
                        value={editingIps}
                        onChange={(e) => setEditingIps(e.target.value)}
                        placeholder="Clear = allow all IPs"
                      />
                      <div className="row" style={{ gap: 8 }}>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            void (async () => {
                              if (!owned) return;
                              setSaving(true);
                              try {
                                const res = await updateOrganizationApiKey(owned.id, key.id, {
                                  allowed_ips: editingIps.trim() === "" ? [] : editingIps,
                                });
                                if (!res.success || !res.data?.key) {
                                  toast.error(res.error?.message ?? "Could not update IP allowlist.");
                                  return;
                                }
                                setKeys((prev) => prev.map((k) => (k.id === key.id ? res.data!.key : k)));
                                setEditingIpKeyId(null);
                                setEditingIps("");
                                toast.success("IP allowlist updated.");
                              } catch (err) {
                                toast.error(getApiErrorMessage(err, "Could not update IP allowlist."));
                              } finally {
                                setSaving(false);
                              }
                            })();
                          }}
                        >
                          Save IPs
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            setEditingIpKeyId(null);
                            setEditingIps("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                {key.is_active ? (
                  <div className="row" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setEditingIpKeyId(key.id);
                        setEditingIps((key.allowed_ips ?? []).join(", "));
                      }}
                    >
                      Edit IPs
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => void handleRevoke(key)}>
                      Revoke
                    </button>
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}

      {!loading && enabled ? (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              if (!owned || !webhookUrl.trim()) {
                toast.error("Enter a webhook URL.");
                return;
              }
              setWebhookSaving(true);
              try {
                const res = await upsertOrganizationWebhook(owned.id, {
                  url: webhookUrl.trim(),
                  is_active: true,
                });
                if (!res.success || !res.data?.endpoint) {
                  toast.error(res.error?.message ?? "Could not save webhook.");
                  return;
                }
                setWebhookEndpoint(res.data.endpoint);
                if (res.data.endpoint.secret) setWebhookSecret(res.data.endpoint.secret);
                toast.success(
                  res.data.endpoint.secret
                    ? "Webhook saved. Copy the signing secret now."
                    : "Webhook saved.",
                );
              } catch (err) {
                toast.error(getApiErrorMessage(err, "Could not save webhook."));
              } finally {
                setWebhookSaving(false);
              }
            })();
          }}
        >
          <h2 className="profile-card-title">Webhook endpoint</h2>
          <p className="muted" style={{ margin: 0 }}>
            HTTPS URL for signed job updates. Copy the signing secret when shown.
          </p>
          {webhookSecret ? (
            <div className="stack">
              <strong>Signing secret (copy now)</strong>
              <code style={{ display: "block", wordBreak: "break-all", fontSize: 12 }}>{webhookSecret}</code>
              <button type="button" className="btn-ghost" onClick={() => setWebhookSecret(null)}>
                Dismiss
              </button>
            </div>
          ) : null}
          <label className="stack">
            <span className="muted">HTTPS URL</span>
            <input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-app.com/webhooks/goquick"
            />
          </label>
          {webhookEndpoint ? (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              {webhookEndpoint.is_active ? "Active" : "Inactive"} · Secret{" "}
              {webhookEndpoint.secret_hint ?? "—"}
            </p>
          ) : null}
          <div className="row" style={{ gap: 8 }}>
            <button type="submit" className="btn-primary" disabled={webhookSaving}>
              {webhookSaving ? "Saving…" : webhookEndpoint ? "Save webhook" : "Create webhook"}
            </button>
            {webhookEndpoint ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={webhookSaving}
                onClick={() => {
                  if (!owned) return;
                  if (!window.confirm("Rotate signing secret? Update your verifier immediately.")) return;
                  void (async () => {
                    setWebhookSaving(true);
                    try {
                      const res = await upsertOrganizationWebhook(owned.id, {
                        url: webhookUrl.trim() || webhookEndpoint.url,
                        rotate_secret: true,
                      });
                      if (!res.success || !res.data?.endpoint?.secret) {
                        toast.error(res.error?.message ?? "Could not rotate secret.");
                        return;
                      }
                      setWebhookEndpoint(res.data.endpoint);
                      setWebhookSecret(res.data.endpoint.secret);
                      toast.success("Secret rotated. Copy it now.");
                    } catch (err) {
                      toast.error(getApiErrorMessage(err, "Could not rotate secret."));
                    } finally {
                      setWebhookSaving(false);
                    }
                  })();
                }}
              >
                Rotate secret
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {!loading && deliveries.length > 0 ? (
        <div className="card stack">
          <h2 className="profile-card-title">Recent deliveries</h2>
          <ul className="saved-places-list">
            {deliveries.map((d) => (
              <li key={d.id} className="card saved-place-row">
                <div>
                  <strong>
                    {d.event} · {d.success ? "OK" : "FAIL"}
                    {d.response_status != null ? ` · HTTP ${d.response_status}` : ""}
                  </strong>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                    {d.created_at ? new Date(d.created_at).toLocaleString() : ""}
                    {` · try #${d.attempt}`}
                    {d.errand_id ? ` · job #${d.errand_id}` : ""}
                  </p>
                  {d.error_message ? (
                    <p className="error" style={{ margin: "4px 0 0", fontSize: 12 }}>
                      {d.error_message}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
