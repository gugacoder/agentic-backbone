import { tool } from "ai";
import { z } from "zod";
import { findChannelsByAdapter } from "../../../channels/lookup.js";
import { findOrCreateSession } from "../../../conversations/index.js";
import { loadTwilioConfigFromChannel } from "../config.js";
import { createCall } from "../calls.js";

export function createMakeCallTool(): Record<string, any> {
  return {
    make_call: tool({
      description:
        "Inicia uma ligação telefônica via Twilio. Use quando o usuário pedir para ligar ou quando precisar fazer uma chamada de voz.",
      parameters: z.object({
        reason: z
          .string()
          .describe("Motivo da ligação — será a primeira mensagem do agente ao atender"),
        channelId: z
          .string()
          .optional()
          .describe("Slug do canal twilio-voice (usa o primeiro disponível se omitido)"),
      }),
      execute: async (args) => {
        const channels = findChannelsByAdapter("twilio-voice");
        const channel = args.channelId
          ? channels.find((ch) => ch.slug === args.channelId)
          : channels[0];

        if (!channel) {
          return { error: "no_twilio_voice_channel" };
        }

        const agentId = channel.metadata.agent as string | undefined;
        if (!agentId) {
          return { error: "channel_has_no_agent" };
        }

        const toNumber = channel.metadata["to-number"] as string | undefined;
        if (!toNumber) {
          return { error: "channel_has_no_to_number" };
        }

        let config;
        try {
          config = loadTwilioConfigFromChannel(channel);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }

        const statusCallbackUrl = `${config.callbackBaseUrl}/api/v1/ai/connectors/twilio/webhook/status`;
        const voiceWebhookUrl = `${config.callbackBaseUrl}/api/v1/ai/connectors/twilio/webhook/voice`;

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`;
        const authHeader =
          "Basic " + Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");

        const params = new URLSearchParams();
        params.append("To", toNumber);
        params.append("From", config.phoneNumber);
        params.append("Url", voiceWebhookUrl);
        params.append("StatusCallback", statusCallbackUrl);
        params.append("StatusCallbackEvent", "initiated");
        params.append("StatusCallbackEvent", "ringing");
        params.append("StatusCallbackEvent", "answered");
        params.append("StatusCallbackEvent", "completed");
        params.append("StatusCallbackMethod", "POST");

        let res;
        try {
          res = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          });
        } catch (err) {
          return { error: `twilio_network_error: ${err instanceof Error ? err.message : String(err)}` };
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
          return { error: "twilio_api_error", details: err };
        }

        const data = (await res.json()) as { sid: string };

        const session = findOrCreateSession(agentId, toNumber, channel.slug);

        createCall({
          callSid: data.sid,
          channelId: channel.slug,
          agentId,
          sessionId: session.session_id,
          senderId: toNumber,
          direction: "outbound",
          reason: args.reason,
          status: "queued",
          createdAt: Date.now(),
          config,
        });

        return { callSid: data.sid, sessionId: session.session_id };
      },
    }),
  };
}
