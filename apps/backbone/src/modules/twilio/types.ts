// --- Voice Session ---

export interface VoiceSession {
  callSid: string;
  channelId: string;
  agentId: string;
  sessionId: string;
  senderId: string; // E.164 phone number
  direction: "inbound" | "outbound";
  reason?: string;
  status: TwilioCallStatus;
  createdAt: number;
}

// --- Call Status ---

export type TwilioCallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "busy"
  | "no-answer"
  | "canceled"
  | "failed";

// --- Configuration ---

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  callbackBaseUrl: string;
  language: string;
  voice: string;
  endCallToken: string;
}
