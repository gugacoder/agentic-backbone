import webpush from "web-push";
import { db } from "../db/index.js";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

const vapidConfigured =
  Boolean(VAPID_PUBLIC_KEY) && Boolean(VAPID_PRIVATE_KEY) && Boolean(VAPID_SUBJECT);

if (vapidConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
  console.log("[push] VAPID keys configured — push notifications enabled");
} else {
  console.log("[push] VAPID keys not configured — push notifications disabled");
}

export function isVapidConfigured(): boolean {
  return vapidConfigured;
}

export async function sendPushToAll(payload: {
  title: string;
  body?: string;
  url?: string;
}): Promise<void> {
  if (!vapidConfigured) return;

  const subscriptions = db
    .prepare("SELECT endpoint, keys_p256dh, keys_auth FROM push_subscriptions")
    .all() as Array<{ endpoint: string; keys_p256dh: string; keys_auth: string }>;

  if (subscriptions.length === 0) return;

  const jsonPayload = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        jsonPayload,
      ),
    ),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    if (result.status === "rejected") {
      const sub = subscriptions[i]!;
      const statusCode = (result.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(sub.endpoint);
        console.log(`[push] removed expired subscription: ${sub.endpoint.slice(0, 60)}...`);
      } else {
        console.error(`[push] failed to send to ${sub.endpoint.slice(0, 60)}...:`, result.reason);
      }
    }
  }
}
