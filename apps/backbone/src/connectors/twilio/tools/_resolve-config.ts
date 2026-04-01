import { findChannelsByAdapter } from "../../../channels/lookup.js";
import { loadTwilioConfigFromChannel } from "../config.js";
import type { TwilioConfig } from "../types.js";

export function resolveTwilioConfig(channelId?: string): TwilioConfig {
  const channels = findChannelsByAdapter("twilio-voice");
  const channel = channelId
    ? channels.find((ch) => ch.slug === channelId)
    : channels[0];
  if (!channel) throw new Error("Nenhum canal twilio-voice configurado");
  return loadTwilioConfigFromChannel(channel);
}
