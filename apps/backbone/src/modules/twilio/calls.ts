import type { VoiceSession, TwilioCallStatus } from "./types.js";

const activeCalls = new Map<string, VoiceSession>();

export function createCall(session: VoiceSession): void {
  activeCalls.set(session.callSid, session);
}

export function getCall(callSid: string): VoiceSession | undefined {
  return activeCalls.get(callSid);
}

export function updateCallStatus(callSid: string, status: TwilioCallStatus): void {
  const session = activeCalls.get(callSid);
  if (session) {
    session.status = status;
  }
}

export function removeCall(callSid: string): void {
  activeCalls.delete(callSid);
}

export function listActiveCalls(): VoiceSession[] {
  return Array.from(activeCalls.values());
}

export function clearCalls(): void {
  activeCalls.clear();
}
