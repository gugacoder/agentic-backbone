import { insertNotification } from "../routes/notifications.js";
import { sendPushToAll } from "./push.js";

export interface NotificationInput {
  type: string;
  severity: "info" | "warning" | "error";
  agentId?: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

export function emitNotification(data: NotificationInput): void {
  const id = insertNotification(data);

  if (data.severity === "error" || data.severity === "warning") {
    sendPushToAll({
      title: data.title,
      body: data.body,
      url: data.metadata?.url as string | undefined,
    }).catch((err) =>
      console.error(`[notifications] push failed for notification #${id}:`, err),
    );
  }
}
