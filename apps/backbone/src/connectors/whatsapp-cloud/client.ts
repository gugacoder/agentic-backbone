import type { z } from "zod";
import type { credentialSchema, optionsSchema } from "./schemas.js";

type Credential = z.infer<typeof credentialSchema>;
type Options = z.infer<typeof optionsSchema>;

export class WhatsAppCloudClient {
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly apiVersion: string;
  private readonly baseUrl: string;

  constructor(credential: Credential, options: Options) {
    this.accessToken = credential.access_token;
    this.phoneNumberId = credential.phone_number_id;
    this.apiVersion = options.api_version;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
  }

  async sendText(to: string, body: string): Promise<void> {
    await this.request("POST", `/${this.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    });
  }

  async sendTemplate(to: string, templateName: string, languageCode: string): Promise<void> {
    await this.request("POST", `/${this.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    });
  }

  async getMediaUrl(mediaId: string): Promise<string> {
    const data = await this.request("GET", `/${mediaId}`) as { url?: string };
    if (!data.url) throw new Error(`No URL returned for media ${mediaId}`);
    return data.url;
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.request("POST", `/${this.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });
  }
}

export function createWhatsAppCloudClient(credential: Credential, options: Options): WhatsAppCloudClient {
  return new WhatsAppCloudClient(credential, options);
}
