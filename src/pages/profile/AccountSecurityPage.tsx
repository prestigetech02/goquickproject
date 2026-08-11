import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { useToast } from "../../components/ToastProvider";
import { clearSession } from "../../lib/auth";
import { getApiErrorMessage } from "../../lib/http";
import {
  useChangePasswordMutation,
  useDeactivateAccountMutation,
  useDeleteAccountMutation,
} from "../../lib/queries";

export function AccountSecurityPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const changePw = useChangePasswordMutation();
  const deactivate = useDeactivateAccountMutation();
  const remove = useDeleteAccountMutation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [dangerMode, setDangerMode] = useState<"deactivate" | "delete" | null>(null);
  const [dangerPassword, setDangerPassword] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    try {
      await changePw.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to change password."));
    }
  }

  async function handleDangerSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dangerPassword) {
      toast.error("Enter your password to continue.");
      return;
    }
    try {
      if (dangerMode === "deactivate") {
        await deactivate.mutateAsync(dangerPassword);
        toast.success("Account deactivated.");
      } else if (dangerMode === "delete") {
        await remove.mutateAsync({ password: dangerPassword, reason: deleteReason.trim() });
        toast.success("Account deletion requested.");
      }
      clearSession();
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Request failed."));
    }
  }

  const dangerBusy = deactivate.isPending || remove.isPending;

  return (
    <div className="page profile-page">
      <ProfileSubHeader title="Account & Security" />

      <form onSubmit={handleChangePassword} className="card stack profile-form">
        <h2 className="profile-card-title">Change password</h2>

        <label htmlFor="sec-current">Current password</label>
        <input
          id="sec-current"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        <label htmlFor="sec-new">New password</label>
        <input
          id="sec-new"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />

        <label htmlFor="sec-confirm">Confirm new password</label>
        <input
          id="sec-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />

        <button type="submit" className="btn-primary" disabled={changePw.isPending}>
          {changePw.isPending ? "Updating…" : "Update password"}
        </button>
      </form>

      <section className="card stack profile-danger-card">
        <h2 className="profile-card-title">Danger zone</h2>
        <p className="muted">These actions require your password.</p>

        <div className="profile-danger-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setDangerMode("deactivate");
            }}
          >
            Deactivate account
          </button>
          <button
            type="button"
            className="btn-ghost profile-danger-btn"
            onClick={() => {
              setDangerMode("delete");
            }}
          >
            Delete account
          </button>
        </div>

        {dangerMode ? (
          <form onSubmit={handleDangerSubmit} className="stack">
            <p className="muted">
              {dangerMode === "deactivate"
                ? "Your account will be deactivated. You can contact support to restore it."
                : "This permanently requests account deletion. This cannot be undone easily."}
            </p>
            {dangerMode === "delete" ? (
              <>
                <label htmlFor="del-reason">Reason (optional)</label>
                <input
                  id="del-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                />
              </>
            ) : null}
            <label htmlFor="danger-pw">Password</label>
            <input
              id="danger-pw"
              type="password"
              value={dangerPassword}
              onChange={(e) => setDangerPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <div className="profile-danger-actions">
              <button type="button" className="btn-ghost" onClick={() => setDangerMode(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary profile-danger-btn" disabled={dangerBusy}>
                {dangerBusy
                  ? "Working…"
                  : dangerMode === "deactivate"
                    ? "Deactivate"
                    : "Delete account"}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
