import { ProfileSubHeader } from "../../components/ProfileSubHeader";
import { getApiErrorMessage } from "../../lib/http";
import {
  useNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
} from "../../lib/queries";
import type { NotificationSettings } from "../../types/api";

const LABELS: { key: keyof NotificationSettings; title: string; hint: string }[] = [
  { key: "push_enabled", title: "Push notifications", hint: "Alerts on this device when available" },
  { key: "email_enabled", title: "Email", hint: "Updates sent to your email address" },
  { key: "sms_enabled", title: "SMS", hint: "Text messages for important updates" },
  { key: "errand_updates", title: "Errand updates", hint: "Status changes on your errands" },
  { key: "chat_messages", title: "Chat messages", hint: "New messages from runners" },
  { key: "payouts", title: "Payments & wallet", hint: "Top-ups, charges, and refunds" },
  { key: "promotions", title: "Promotions", hint: "Offers and product news" },
];

export function NotificationSettingsPage() {
  const { data, error, isPending } = useNotificationSettingsQuery();
  const update = useUpdateNotificationSettingsMutation();

  async function toggle(key: keyof NotificationSettings, value: boolean) {
    try {
      await update.mutateAsync({ [key]: value });
    } catch {
      // error surfaced via mutation; keep previous cache
    }
  }

  const errorMessage =
    error instanceof Error
      ? error.message
      : error
        ? "Failed to load settings"
        : update.error
          ? getApiErrorMessage(update.error, "Failed to save")
          : null;

  return (
    <div className="page profile-page">
      <ProfileSubHeader title="Notification Settings" />

      {isPending && !data ? <p className="muted">Loading…</p> : null}
      {errorMessage ? <p className="error">{errorMessage}</p> : null}

      <section className="card profile-settings-list">
        {LABELS.map(({ key, title, hint }) => {
          const on = Boolean(data?.[key]);
          return (
            <label key={key} className="profile-toggle-row">
              <span className="profile-menu-text">
                <span className="profile-menu-title">{title}</span>
                <span className="profile-menu-sub">{hint}</span>
              </span>
              <input
                type="checkbox"
                checked={on}
                disabled={!data || update.isPending}
                onChange={(e) => void toggle(key, e.target.checked)}
              />
            </label>
          );
        })}
      </section>
    </div>
  );
}
