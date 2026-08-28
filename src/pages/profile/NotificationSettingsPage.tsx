import { useState } from "react";

import { ProfileSubHeader } from "../../components/ProfileSubHeader";

import { getApiErrorMessage } from "../../lib/http";

import {

  useNotificationSettingsQuery,

  useUpdateNotificationSettingsMutation,

} from "../../lib/queries";

import {
  disableWebPush,
  enableWebPush,
  isWebPushConfigured,
} from "../../lib/webPush";

import type { NotificationSettings } from "../../types/api";



const LABELS: { key: keyof NotificationSettings; title: string; hint: string }[] = [

  {

    key: "push_enabled",

    title: "Browser push",

    hint: "Alerts on this device when GoQuick is in the background",

  },

  { key: "email_enabled", title: "Email", hint: "Updates sent to your email address" },

  { key: "errand_updates", title: "Errand updates", hint: "Status changes and new offers on your errands" },

  { key: "chat_messages", title: "Chat messages", hint: "New messages from runners" },

  { key: "payouts", title: "Payments & wallet", hint: "Top-ups, charges, and refunds" },

  { key: "promotions", title: "Promotions", hint: "Offers and product news" },

];



export function NotificationSettingsPage() {

  const { data, error, isPending } = useNotificationSettingsQuery();

  const update = useUpdateNotificationSettingsMutation();

  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const webPushReady = isWebPushConfigured();



  async function toggle(key: keyof NotificationSettings, value: boolean) {

    setPushMessage(null);



    if (key === "push_enabled") {

      if (value) {

        if (!webPushReady) {

          setPushMessage("Browser push is not configured for this environment yet.");

          return;

        }



        const { ok, permission } = await enableWebPush();

        if (!ok) {

          if (permission === "denied") {

            setPushMessage("Notifications are blocked in your browser. Enable them in site settings to use push.");

          } else if (permission === "unsupported") {

            setPushMessage("This browser does not support web push notifications.");

          } else {

            setPushMessage("Could not enable browser push. Try again or check your browser permissions.");

          }

          return;

        }

      } else {

        await disableWebPush();

      }

    }



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

      {pushMessage ? <p className="error">{pushMessage}</p> : null}



      <p className="muted profile-settings-intro">

        In-app alerts appear in your notification bell while you&apos;re on GoQuick. Browser push

        and email cover updates when you&apos;re away.

      </p>



      <section className="card profile-settings-list">

        {LABELS.map(({ key, title, hint }) => {

          const on = Boolean(data?.[key]);

          const disabled =

            !data ||

            update.isPending ||

            (key === "push_enabled" && !webPushReady);



          return (

            <label key={key} className="profile-toggle-row">

              <span className="profile-menu-text">

                <span className="profile-menu-title">{title}</span>

                <span className="profile-menu-sub">

                  {key === "push_enabled" && !webPushReady

                    ? "Not available until Firebase web push is configured"

                    : hint}

                </span>

              </span>

              <input

                type="checkbox"

                checked={on}

                disabled={disabled}

                onChange={(e) => void toggle(key, e.target.checked)}

              />

            </label>

          );

        })}

      </section>

    </div>

  );

}

