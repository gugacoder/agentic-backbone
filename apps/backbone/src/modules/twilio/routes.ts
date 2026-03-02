import { Hono, type Context } from "hono";
import type { TwilioConfig } from "./types.js";
import { createCall, getCall, updateCallStatus, removeCall, listActiveCalls } from "./calls.js";
import { buildSayAndGatherTwiml, buildHangupTwiml, parseEndCallSignal } from "./twiml.js";
import { findChannelsByAdapter } from "../../channels/lookup.js";
import { findOrCreateSession, sendMessage } from "../../conversations/index.js";
import type { TwilioCallStatus } from "./types.js";

const TERMINAL_STATUSES: TwilioCallStatus[] = ["completed", "busy", "no-answer", "canceled", "failed"];

async function consumeAgentResponse(userId: string, sessionId: string, message: string): Promise<string> {
  let fullText = "";
  for await (const event of sendMessage(userId, sessionId, message)) {
    if (event.type === "result" && event.content) {
      fullText = event.content;
    } else if (event.type === "text" && event.content) {
      fullText += event.content;
    }
  }
  return fullText;
}

function stripChannelPrefix(text: string): string {
  // Strip any [canal: ...] prefix the agent may echo back (twilio-voice, voz, voice, etc.)
  return text.replace(/^\[canal:\s*[^\]]*\]\s*/i, "").trim();
}

function twimlResponse(c: Context, xml: string): Response {
  return c.text(xml, 200, { "Content-Type": "application/xml" });
}

export function createTwilioRoutes(config: TwilioConfig): Hono {
  const app = new Hono();

  // --- POST /calls — Create outbound call ---

  app.post("/calls", async (c) => {
    const body = await c.req.json<{ to: string; channelId?: string; reason?: string }>();

    if (!body.to) {
      return c.json({ ok: false, error: "missing_to" }, 400);
    }

    // Find a twilio-voice channel
    const channels = findChannelsByAdapter("twilio-voice");
    const channel = body.channelId
      ? channels.find((ch) => ch.slug === body.channelId)
      : channels[0];

    if (!channel) {
      return c.json({ ok: false, error: "no_twilio_voice_channel" }, 400);
    }

    const agentId = channel.metadata.agent as string | undefined;
    if (!agentId) {
      return c.json({ ok: false, error: "channel_has_no_agent" }, 400);
    }

    const statusCallbackUrl = `${config.callbackBaseUrl}/api/v1/ai/modules/twilio/webhook/status`;
    const voiceWebhookUrl = `${config.callbackBaseUrl}/api/v1/ai/modules/twilio/webhook/voice`;

    // Create call via Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`;
    const authHeader = "Basic " + Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");

    const params = new URLSearchParams();
    params.append("To", body.to);
    params.append("From", config.phoneNumber);
    params.append("Url", voiceWebhookUrl);
    params.append("StatusCallback", statusCallbackUrl);
    params.append("StatusCallbackEvent", "initiated");
    params.append("StatusCallbackEvent", "ringing");
    params.append("StatusCallbackEvent", "answered");
    params.append("StatusCallbackEvent", "completed");
    params.append("StatusCallbackMethod", "POST");

    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      return c.json({ ok: false, error: "twilio_api_error", details: err }, 502);
    }

    const data = await res.json() as { sid: string };

    // Create session for this call
    const session = findOrCreateSession(agentId, body.to, channel.slug);

    createCall({
      callSid: data.sid,
      channelId: channel.slug,
      agentId,
      sessionId: session.session_id,
      senderId: body.to,
      direction: "outbound",
      reason: body.reason,
      status: "queued",
      createdAt: Date.now(),
    });

    return c.json({ ok: true, data: { callSid: data.sid, sessionId: session.session_id } });
  });

  // --- POST /webhook/voice — Twilio calls this when connected ---

  app.post("/webhook/voice", async (c) => {
    const form = await c.req.parseBody() as Record<string, string>;
    const callSid = form.CallSid;
    const from = form.From;
    const direction = form.Direction;

    if (!callSid) {
      return twimlResponse(c, buildHangupTwiml(config, "Erro interno."));
    }

    let voiceSession = getCall(callSid);

    if (voiceSession) {
      // Outbound call — we already have a session
      const agentMessage = voiceSession.reason ?? "O usuário atendeu a ligação.";
      const agentResponse = await consumeAgentResponse(
        voiceSession.senderId,
        voiceSession.sessionId,
        agentMessage,
      );
      const cleaned = stripChannelPrefix(agentResponse);

      if (!cleaned) {
        return twimlResponse(c, buildHangupTwiml(config, "Desculpe, ocorreu um erro."));
      }

      const { shouldEnd, cleanText } = parseEndCallSignal(cleaned, config.endCallToken);
      if (shouldEnd) {
        return twimlResponse(c, buildHangupTwiml(config, cleanText || "Ate logo."));
      }

      return twimlResponse(c, buildSayAndGatherTwiml(config, cleanText, callSid));
    }

    // Inbound call — find channel and create session
    const channels = findChannelsByAdapter("twilio-voice");
    const channel = channels[0];

    if (!channel) {
      return twimlResponse(c, buildHangupTwiml(config, "Servico indisponivel."));
    }

    const agentId = channel.metadata.agent as string | undefined;
    if (!agentId) {
      return twimlResponse(c, buildHangupTwiml(config, "Servico indisponivel."));
    }

    const senderId = from || "unknown";
    const session = findOrCreateSession(agentId, senderId, channel.slug);

    createCall({
      callSid,
      channelId: channel.slug,
      agentId,
      sessionId: session.session_id,
      senderId,
      direction: (direction === "outbound-api" ? "outbound" : "inbound"),
      status: "in-progress",
      createdAt: Date.now(),
    });

    voiceSession = getCall(callSid)!;

    const agentMessage = `Ligação recebida de ${senderId}.`;
    const agentResponse = await consumeAgentResponse(
      senderId,
      session.session_id,
      agentMessage,
    );
    const cleaned = stripChannelPrefix(agentResponse);

    if (!cleaned) {
      return twimlResponse(c, buildHangupTwiml(config, "Desculpe, ocorreu um erro."));
    }

    const { shouldEnd, cleanText } = parseEndCallSignal(cleaned, config.endCallToken);
    if (shouldEnd) {
      return twimlResponse(c, buildHangupTwiml(config, cleanText || "Ate logo."));
    }

    return twimlResponse(c, buildSayAndGatherTwiml(config, cleanText, callSid));
  });

  // --- POST /webhook/gather — Twilio sends speech transcription ---

  app.post("/webhook/gather", async (c) => {
    const form = await c.req.parseBody() as Record<string, string>;
    const callSid = c.req.query("callSid") ?? form.CallSid;
    const speechResult = form.SpeechResult;

    if (!callSid) {
      return twimlResponse(c, buildHangupTwiml(config, "Erro interno."));
    }

    const voiceSession = getCall(callSid);
    if (!voiceSession) {
      return twimlResponse(c, buildHangupTwiml(config, "Sessao nao encontrada."));
    }

    if (!speechResult) {
      // No speech detected — re-prompt
      return twimlResponse(c, buildSayAndGatherTwiml(config, "Desculpe, nao entendi. Pode repetir?", callSid));
    }

    const agentMessage = speechResult;
    const agentResponse = await consumeAgentResponse(
      voiceSession.senderId,
      voiceSession.sessionId,
      agentMessage,
    );
    const cleaned = stripChannelPrefix(agentResponse);

    if (!cleaned) {
      return twimlResponse(c, buildHangupTwiml(config, "Desculpe, ocorreu um erro."));
    }

    const { shouldEnd, cleanText } = parseEndCallSignal(cleaned, config.endCallToken);
    if (shouldEnd) {
      return twimlResponse(c, buildHangupTwiml(config, cleanText || "Ate logo."));
    }

    return twimlResponse(c, buildSayAndGatherTwiml(config, cleanText, callSid));
  });

  // --- POST /webhook/status — Twilio call status updates ---

  app.post("/webhook/status", async (c) => {
    const form = await c.req.parseBody() as Record<string, string>;
    const callSid = form.CallSid;
    const callStatus = form.CallStatus as TwilioCallStatus | undefined;

    if (callSid && callStatus) {
      updateCallStatus(callSid, callStatus);

      if (TERMINAL_STATUSES.includes(callStatus)) {
        removeCall(callSid);
      }
    }

    return c.json({ status: "ok" });
  });

  // --- GET /health ---

  app.get("/health", (c) => {
    const calls = listActiveCalls();
    return c.json({
      ok: true,
      data: {
        status: "healthy",
        activeCalls: calls.length,
      },
    });
  });

  // --- GET /calls ---

  app.get("/calls", (c) => {
    return c.json({ ok: true, data: listActiveCalls() });
  });

  return app;
}
