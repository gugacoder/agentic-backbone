import { WebClient } from "@slack/web-api";
import type { z } from "zod";
import type { credentialSchema } from "./schemas.js";

type Credential = z.infer<typeof credentialSchema>;

export class SlackClient {
  readonly web: WebClient;

  constructor(credential: Credential) {
    this.web = new WebClient(credential.bot_token);
  }

  async postMessage(channel: string, text: string, threadTs?: string): Promise<{ ok: boolean; ts: string }> {
    const res = await this.web.chat.postMessage({
      channel,
      text,
      ...(threadTs ? { thread_ts: threadTs } : {}),
    });
    return { ok: res.ok ?? false, ts: (res.ts as string) ?? "" };
  }
}

export function createSlackClient(credential: Credential): SlackClient {
  return new SlackClient(credential);
}
