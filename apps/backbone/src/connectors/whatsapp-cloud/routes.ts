import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import { findChannelByMetadata } from "../../channels/lookup.js";
import { routeInboundMessage } from "../../channels/delivery/inbound-router.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createWhatsAppCloudClient } from "./client.js";
import type { ResolvedAdapter } from "../types.js";

export interface WhatsAppCloudRouteDeps {
  findAdapter: (slug: string) => Promise<ResolvedAdapter | null>;
}

/**
 * Creates the WhatsApp Cloud connector Hono sub-app.
 *
 * Mounted at /connectors/whatsapp-cloud/ by the connector registry.
 *
 * Webhook verification (Meta hub challenge):
 *   GET /:adapterId/webhook — validates hub.verify_token, returns hub.challenge
 *
 * Inbound messages:
 *   POST /:adapterId/webhook — validates X-Hub-Signature-256 (HMAC-SHA256 timing-safe),
 *                              extracts messages from Meta payload, routes to channel adapter
 */
export function createWhatsAppCloudRoutes(deps: WhatsAppCloudRouteDeps): Hono {
  const app = new Hono();

  // --- GET /:adapterId/webhook — Meta hub.challenge verification ---

  app.get("/:adapterId/webhook", async (c) => {
    const adapterId = c.req.param("adapterId");
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");

    const adapter = await deps.findAdapter(adapterId);
    if (!adapter) return c.text("adapter not found", 404);

    const credResult = credentialSchema.safeParse(adapter.credential);
    if (!credResult.success) return c.text("invalid adapter config", 500);

    if (mode === "subscribe" && token === credResult.data.webhook_verify_token) {
      return c.text(challenge ?? "");
    }

    return c.text("forbidden", 403);
  });

  // --- POST /:adapterId/webhook — inbound messages from Meta ---

  app.post("/:adapterId/webhook", async (c) => {
    const adapterId = c.req.param("adapterId");

    const adapter = await deps.findAdapter(adapterId);
    if (!adapter) return c.json({ status: "adapter_not_found" }, 404);

    const credResult = credentialSchema.safeParse(adapter.credential);
    if (!credResult.success) return c.json({ status: "invalid_config" }, 500);

    const optsResult = optionsSchema.safeParse(adapter.options);
    const autoReplyRead = optsResult.success ? optsResult.data.auto_reply_read : true;
    const apiVersion = optsResult.success ? optsResult.data.api_version : "v19.0";

    // Read raw body for HMAC validation
    const rawBody = await c.req.text();
    const signature = c.req.header("x-hub-signature-256");

    if (!signature) {
      return c.json({ status: "unauthorized" }, 401);
    }

    // Timing-safe HMAC-SHA256 validation
    const expected =
      "sha256=" + createHmac("sha256", credResult.data.app_secret).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return c.json({ status: "unauthorized" }, 401);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return c.json({ status: "invalid_json" }, 400);
    }

    const payload = body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            metadata?: { phone_number_id?: string };
            messages?: Array<{
              id: string;
              from: string;
              type: string;
              text?: { body: string };
            }>;
          };
        }>;
      }>;
    };

    const entries = payload.entry ?? [];

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        const messages = value.messages ?? [];
        const phoneNumberId =
          value.metadata?.phone_number_id ?? credResult.data.phone_number_id;

        for (const msg of messages) {
          if (msg.type !== "text" || !msg.text?.body) continue;

          const senderId = msg.from;
          const content = msg.text.body;
          const messageId = msg.id;

          // Find channel by adapter instance slug or by channel-adapter tag
          const channel =
            findChannelByMetadata("instance", adapterId) ??
            findChannelByMetadata("channel-adapter", "whatsapp-cloud");

          if (!channel) {
            console.warn(
              `[whatsapp-cloud/webhook] no channel found for adapter "${adapterId}"`
            );
            continue;
          }

          // markAsRead fire-and-forget if configured
          if (autoReplyRead) {
            const client = createWhatsAppCloudClient(credResult.data, {
              api_version: apiVersion,
              auto_reply_read: autoReplyRead,
            });
            client.markAsRead(messageId).catch((err) => {
              console.error(`[whatsapp-cloud] markAsRead failed:`, err);
            });
          }

          routeInboundMessage(channel.slug, {
            senderId,
            content,
            ts: Date.now(),
            metadata: { adapterId, messageId, phoneNumberId },
          }).catch((err) => {
            console.error(`[whatsapp-cloud/webhook] routing failed:`, err);
          });
        }
      }
    }

    return c.json({ status: "accepted" }, 200);
  });

  return app;
}
