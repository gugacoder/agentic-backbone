import { Hono, type Context } from "hono";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EvolutionProbe } from "./probe.js";
import type { EvolutionStateTracker } from "./state.js";
import type { EvolutionActions, ActionResult } from "./actions.js";
import { findChannelsByAdapter } from "../../channels/lookup.js";
import { routeInboundMessage } from "../../channels/delivery/inbound-router.js";
import { findOrCreateSession } from "../../conversations/index.js";
import { agentDir } from "../../context/paths.js";
import { generateAttachmentId, type ContentPart } from "../../conversations/attachments.js";
import {
  getPendingRating,
  handlePossibleRatingReply,
  lastAssistantMessageIndex,
  setPendingRating,
  RATING_DISABLED_PENDING_REDESIGN,
} from "./whatsapp-rating.js";

interface RouteDeps {
  probe: EvolutionProbe;
  state: EvolutionStateTracker;
  actions: EvolutionActions;
  env: Record<string, string | undefined>;
}

/**
 * Creates the Evolution connector Hono sub-app with monitoring and CRUD routes.
 *
 * Mounted at /connectors/evolution/ by the connector registry.
 *
 * Monitoring:
 *   GET  /health                      — API state + last probe + response time
 *   GET  /instances                   — all instances with state + duration
 *   GET  /instances/:name             — single instance detail
 *   POST /instances/:name/reconnect   — reconnect action (retry policy)
 *   POST /instances/:name/restart     — restart action (retry policy)
 *
 * CRUD + QR (proxy to Evolution API):
 *   POST   /instances                 — create instance
 *   DELETE /instances/:name           — delete instance
 *   GET    /instances/:name/qr        — get QR code (base64)
 *   GET    /instances/:name/settings  — get instance settings
 *   PATCH  /instances/:name/settings  — update instance settings
 */
export function createEvolutionRoutes(deps: RouteDeps): Hono {
  const app = new Hono();
  const baseUrl = deps.env.EVOLUTION_URL!;
  const apiKey = deps.env.EVOLUTION_API_KEY!;

  // --- GET /health ---

  app.get("/health", (c) => {
    const apiState = deps.probe.getState();
    const lastProbe = deps.probe.getLastProbe();

    return c.json({
      apiState,
      lastProbe: lastProbe
        ? {
            timestamp: lastProbe.timestamp,
            status: lastProbe.status,
            responseTimeMs: lastProbe.responseTimeMs,
            error: lastProbe.error,
          }
        : null,
    });
  });

  // --- GET /instances ---

  app.get("/instances", (c) => {
    const apiState = deps.probe.getState();

    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    const instances = deps.state.getInstances();
    return ok(c, instances);
  });

  // --- GET /instances/:name ---

  app.get("/instances/:name", (c) => {
    const name = c.req.param("name");
    const apiState = deps.probe.getState();

    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    const instance = deps.state.getInstance(name);
    if (!instance) {
      return fail(c, "instance_not_found");
    }

    return ok(c, instance);
  });

  // --- POST /instances/:name/reconnect ---

  app.post("/instances/:name/reconnect", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    const instance = deps.state.getInstance(name);
    if (!instance) {
      return fail(c, "instance_not_found");
    }

    const result = await deps.actions.reconnect(name);
    return actionResultToResponse(c, result);
  });

  // --- POST /instances/:name/restart ---

  app.post("/instances/:name/restart", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    const instance = deps.state.getInstance(name);
    if (!instance) {
      return fail(c, "instance_not_found");
    }

    const result = await deps.actions.restart(name);
    return actionResultToResponse(c, result);
  });

  // --- POST /instances (create) ---

  app.post("/instances", async (c) => {
    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    const body = await c.req.json<{ instanceName: string }>();
    if (!body.instanceName) {
      return fail(c, "instance_name_required");
    }

    try {
      const response = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: body.instanceName,
          integration: "WHATSAPP-BAILEYS",
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        return fail(c, "create_failed", err);
      }

      const data = await response.json();

      // Registrar webhook para a nova instância
      const callbackHost = deps.env.BACKBONE_CALLBACK_HOST ?? "localhost";
      const backbonePort = deps.env.BACKBONE_PORT;
      const webhookUrl = `http://${callbackHost}:${backbonePort}/api/v1/ai/connectors/evolution/webhook`;
      try {
        await fetch(`${baseUrl}/webhook/set/${body.instanceName}`, {
          method: "POST",
          headers: { apikey: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              webhook_by_events: false,
              events: ["MESSAGES_UPSERT"],
            },
          }),
        });
      } catch (webhookErr) {
        console.warn(`[evolution] webhook registration failed for ${body.instanceName}:`, webhookErr);
      }

      // Invalidate state cache so new instance appears immediately
      void deps.probe.forceTick();
      return ok(c, data);
    } catch (err) {
      return fail(c, "create_failed", String(err));
    }
  });

  // --- DELETE /instances/:name ---

  app.delete("/instances/:name", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    try {
      const response = await fetch(`${baseUrl}/instance/delete/${name}`, {
        method: "DELETE",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        return fail(c, "delete_failed", err);
      }

      const data = await response.json().catch(() => null);
      // Invalidate state cache so removed instance disappears immediately
      void deps.probe.forceTick();
      return ok(c, data);
    } catch (err) {
      return fail(c, "delete_failed", String(err));
    }
  });

  // --- GET /instances/:name/qr ---

  app.get("/instances/:name/qr", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    return proxyGet(c, `${baseUrl}/instance/connect/${name}`, apiKey, "qr_unavailable");
  });

  // --- GET /instances/:name/settings ---

  app.get("/instances/:name/settings", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    return proxyGet(c, `${baseUrl}/settings/find/${name}`, apiKey, "settings_fetch_failed");
  });

  // --- PATCH /instances/:name/settings ---

  app.patch("/instances/:name/settings", async (c) => {
    const name = c.req.param("name");

    const apiState = deps.probe.getState();
    if (apiState === "offline") {
      return fail(c, "api_offline");
    }

    const settings = await c.req.json();

    try {
      const response = await fetch(`${baseUrl}/settings/set/${name}`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        return fail(c, "settings_update_failed", err);
      }

      const data = await response.json();
      return ok(c, data);
    } catch (err) {
      return fail(c, "settings_update_failed", String(err));
    }
  });

  // --- POST /webhook (inbound messages from Evolution) ---

  app.post("/webhook", async (c) => {
    const body = await c.req.json();

    // Evolution webhook payload: { instance, data: { key: { remoteJid }, message: { conversation } }, ... }
    const instanceName = body.instance as string | undefined;
    const remoteJid = body.data?.key?.remoteJid as string | undefined;
    const fromMe = body.data?.key?.fromMe as boolean | undefined;
    const rawMessage = body.data?.message as Record<string, unknown> | undefined;

    if (fromMe) {
      return c.json({ status: "ignored_self" }, 200);
    }

    if (remoteJid?.endsWith("@g.us")) {
      return c.json({ status: "ignored_group" }, 200);
    }

    // Detect audio messages (audioMessage = encoded audio, pttMessage = voice note)
    const audioMsg = rawMessage?.audioMessage ?? rawMessage?.pttMessage;
    let messageText =
      (rawMessage?.conversation as string) ??
      (rawMessage?.extendedTextMessage as Record<string, unknown> | undefined)?.text as string ??
      "";
    let isAudio = false;

    if (!messageText && audioMsg && instanceName) {
      // Check if Whisper is configured
      const whisperHost = deps.env.WHISPER_HOST;
      const whisperPort = deps.env.WHISPER_PORT;
      if (!whisperHost || !whisperPort) {
        return c.json({ status: "ignored_no_whisper" }, 200);
      }

      try {
        // Download audio as base64 from Evolution API
        const msgKey = body.data?.key as Record<string, unknown>;
        const base64Res = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ key: msgKey, convertToMp4: false }),
        });
        if (!base64Res.ok) {
          console.error(`[evolution/webhook] getBase64FromMediaMessage failed HTTP ${base64Res.status}`);
          return c.json({ status: "ignored_audio_error" }, 200);
        }
        const base64Data = await base64Res.json() as { base64?: string; mimetype?: string };
        if (!base64Data.base64) {
          console.error("[evolution/webhook] getBase64FromMediaMessage returned no base64");
          return c.json({ status: "ignored_audio_error" }, 200);
        }

        // Transcribe via Whisper
        const audioBuffer = Buffer.from(base64Data.base64, "base64");
        const mimeType = base64Data.mimetype ?? "audio/ogg";
        const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("mpeg") ? "mp3" : "ogg";
        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: mimeType });
        formData.append("file", blob, `audio.${ext}`);
        formData.append("language", "pt");

        const whisperRes = await fetch(`http://${whisperHost}:${whisperPort}/v1/audio/transcriptions`, {
          method: "POST",
          body: formData,
        });
        if (!whisperRes.ok) {
          console.error(`[evolution/webhook] Whisper transcription failed HTTP ${whisperRes.status}`);
          return c.json({ status: "ignored_audio_error" }, 200);
        }
        const whisperData = await whisperRes.json() as { text?: string };
        const transcript = whisperData.text?.trim();
        if (!transcript) {
          console.error("[evolution/webhook] Whisper returned empty transcript");
          return c.json({ status: "ignored_audio_error" }, 200);
        }

        console.log(`[evolution/webhook] audio transcribed: "${transcript}"`);
        messageText = `[🎙️ Áudio]: "${transcript}"`;
        isAudio = true;
      } catch (err) {
        console.error("[evolution/webhook] audio transcription error:", err);
        return c.json({ status: "ignored_audio_error" }, 200);
      }
    }

    // Detect image messages
    const imageMsg = rawMessage?.imageMessage as Record<string, unknown> | undefined;
    if (!messageText && imageMsg && instanceName && remoteJid) {
      const imgSenderId = remoteJid.split("@")[0]!;
      const imgChannel = findChannelsByAdapter("whatsapp").find(
        (ch) => ch.options["instance"] === instanceName
      );
      if (!imgChannel || !imgChannel.agent) {
        return c.json({ status: "no_channel" }, 200);
      }

      try {
        const msgKey = body.data?.key as Record<string, unknown>;
        const base64Res = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ key: msgKey, convertToMp4: false }),
        });
        if (!base64Res.ok) {
          console.error(`[evolution/webhook] getBase64FromMediaMessage (image) failed HTTP ${base64Res.status}`);
          return c.json({ status: "ignored_image_error" }, 200);
        }
        const base64Data = await base64Res.json() as { base64?: string; mimetype?: string };
        if (!base64Data.base64) {
          console.error("[evolution/webhook] getBase64FromMediaMessage returned no base64 for image");
          return c.json({ status: "ignored_image_error" }, 200);
        }

        const mimeType = (imageMsg.mimetype as string | undefined) ?? "image/jpeg";
        const ext = mimeType.split("/")[1] ?? "jpg";
        const filename = generateAttachmentId(`photo.${ext}`);

        const agentId = imgChannel.agent;
        const session = findOrCreateSession(agentId, imgSenderId, imgChannel.slug);
        const sDir = join(agentDir(agentId), "conversations", session.session_id);
        await mkdir(join(sDir, "attachments"), { recursive: true });
        await writeFile(join(sDir, "attachments", filename), Buffer.from(base64Data.base64, "base64"));

        const caption = imageMsg.caption as string | undefined;
        const imagePart: ContentPart = { type: "image", image: base64Data.base64, mimeType, _ref: filename };
        const contentParts: ContentPart[] = [];
        if (caption) {
          contentParts.push({ type: "text", text: caption });
        }
        contentParts.push(imagePart);

        routeInboundMessage(
          imgChannel.slug,
          {
            senderId: imgSenderId,
            content: contentParts,
            ts: Date.now(),
            metadata: { instance: instanceName, remoteJid },
          },
          async (sessionId, cbAgentId) => {
            if (RATING_DISABLED_PENDING_REDESIGN) return;
            const msgIndex = lastAssistantMessageIndex(cbAgentId, sessionId);
            if (msgIndex < 0) return;
            setPendingRating(imgSenderId, {
              sessionId,
              agentId: cbAgentId,
              channelId: imgChannel.slug,
              instanceName,
              messageIndex: msgIndex,
              step: "awaiting_rating",
            });
            await sendWhatsAppText(baseUrl, apiKey, instanceName, remoteJid, "Essa resposta foi útil? Responda *SIM* ou *NAO*").catch(
              (err) => console.error("[evolution/rating] rating question failed:", err)
            );
          }
        ).catch((err) => {
          console.error("[evolution/webhook] image routing failed:", err);
        });

        return c.json({ status: "accepted" }, 200);
      } catch (err) {
        console.error("[evolution/webhook] image processing error:", err);
        return c.json({ status: "ignored_image_error" }, 200);
      }
    }

    if (!instanceName || !remoteJid || !messageText) {
      return c.json({ status: "ignored" }, 200);
    }

    // Extract sender number from JID (e.g. "5511999999999@s.whatsapp.net" → "5511999999999")
    const senderId = remoteJid.split("@")[0]!;

    // Lookup channel by instance name (stored in options.instance)
    const channel = findChannelsByAdapter("whatsapp").find(
      (ch) => ch.options["instance"] === instanceName
    );
    if (!channel) {
      return c.json({ status: "no_channel" }, 200);
    }

    // ── Rating intercept ─────────────────────────────────────────────────────
    // Check if this sender has a pending rating before routing to the agent.
    const pending = getPendingRating(senderId);
    if (pending) {
      const result = handlePossibleRatingReply(senderId, messageText);
      if (result === "handled") {
        // If now awaiting reason, send optional follow-up prompt
        const stillPending = getPendingRating(senderId);
        if (stillPending?.step === "awaiting_reason") {
          sendWhatsAppText(
            baseUrl,
            apiKey,
            instanceName,
            remoteJid,
            "Pode nos dizer o motivo? (opcional — responda com o texto ou ignore)",
          ).catch((err) => console.error("[evolution/rating] reason prompt failed:", err));
        }
        return c.json({ status: "rating_handled" }, 200);
      }
      // "passthrough" — treat as a new regular message (clear stale state already done)
    }

    // ── Normal agent routing ─────────────────────────────────────────────────
    routeInboundMessage(
      channel.slug,
      {
        senderId,
        content: messageText,
        ts: Date.now(),
        metadata: { instance: instanceName, remoteJid, ...(isAudio ? { isAudio: true } : {}) },
      },
      async (sessionId, agentId) => {
        if (RATING_DISABLED_PENDING_REDESIGN) return;

        // After agent responds, find the last assistant message index
        const msgIndex = lastAssistantMessageIndex(agentId, sessionId);
        if (msgIndex < 0) return;

        // Set pending rating state
        setPendingRating(senderId, {
          sessionId,
          agentId,
          channelId: channel.slug,
          instanceName,
          messageIndex: msgIndex,
          step: "awaiting_rating",
        });

        // Send rating question via WhatsApp
        await sendWhatsAppText(
          baseUrl,
          apiKey,
          instanceName,
          remoteJid,
          "Essa resposta foi útil? Responda *SIM* ou *NAO*",
        ).catch((err) => console.error("[evolution/rating] rating question failed:", err));
      },
    ).catch((err) => {
      console.error(`[evolution/webhook] routing failed:`, err);
    });

    return c.json({ status: "accepted" }, 200);
  });

  return app;
}

// --- WhatsApp send helper ---

async function sendWhatsAppText(
  baseUrl: string,
  apiKey: string,
  instance: string,
  remoteJid: string,
  text: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: remoteJid, text }),
  });
  if (!res.ok) {
    throw new Error(`sendText HTTP ${res.status}`);
  }
}

// --- Response envelope helpers ---

function ok<T>(c: Context, data: T) {
  return c.json({ ok: true, data });
}

function fail(c: Context, error: string, details?: unknown, extra?: Record<string, unknown>) {
  return c.json({ ok: false, error, details, ...extra });
}

async function proxyGet<T>(c: Context, url: string, apiKey: string, errorCode: string) {
  try {
    const response = await fetch(url, { headers: { apikey: apiKey } });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
      return fail(c, errorCode, err);
    }
    const data = await response.json() as T;
    return ok(c, data);
  } catch (err) {
    return fail(c, "network_error", String(err));
  }
}

/**
 * Maps an ActionResult to the appropriate HTTP 200 response with envelope.
 *
 * All scenarios return HTTP 200 — business errors are represented in the body.
 */
function actionResultToResponse(c: Context, result: ActionResult): Response {
  if (result.ok) {
    return ok(c, null);
  }

  if (result.error === "cooldown_active") {
    return fail(c, "cooldown_active", undefined, {
      retryAfterMs: result.retryAfterMs,
    });
  }

  if (result.error === "retries_exhausted") {
    return fail(c, "retries_exhausted", undefined, {
      attempts: result.attempts,
      maxRetries: result.maxRetries,
    });
  }

  return fail(c, result.error ?? "action_failed");
}
