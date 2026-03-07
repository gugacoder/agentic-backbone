import { findChannelsByAdapter } from "../../../channels/lookup.js";
import { createMakeCallTool } from "./make-call.js";
import { createSendSmsTool } from "./send-sms.js";
import { createHangupCallTool } from "./hangup-call.js";
import { createListCallsTool } from "./list-calls.js";
import { createGetCallTool } from "./get-call.js";
import { createListMessagesTool } from "./list-messages.js";
import { createLookupNumberTool } from "./lookup-number.js";

export function createTwilioTools(): Record<string, any> | null {
  const channels = findChannelsByAdapter("twilio-voice");
  if (channels.length === 0) return null;

  return {
    ...createMakeCallTool(),
    ...createSendSmsTool(),
    ...createHangupCallTool(),
    ...createListCallsTool(),
    ...createGetCallTool(),
    ...createListMessagesTool(),
    ...createLookupNumberTool(),
  };
}
