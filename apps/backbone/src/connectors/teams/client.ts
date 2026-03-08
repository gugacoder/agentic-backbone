import type { z } from "zod";
import type { credentialSchema, optionsSchema } from "./schemas.js";

type Credential = z.infer<typeof credentialSchema>;
type Options = z.infer<typeof optionsSchema>;

export class TeamsClient {
  constructor(
    private readonly credential: Credential,
    private readonly options: Options,
  ) {}

  async sendMessage(text: string, title?: string): Promise<{ ok: boolean }> {
    const body = this.options.adaptive_cards
      ? {
          type: "message",
          attachments: [
            {
              contentType: "application/vnd.microsoft.card.adaptive",
              content: {
                $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                type: "AdaptiveCard",
                version: "1.4",
                body: [
                  ...(title
                    ? [{ type: "TextBlock", size: "Medium", weight: "Bolder", text: title }]
                    : []),
                  { type: "TextBlock", wrap: true, text },
                ],
              },
            },
          ],
        }
      : {
          ...(title ? { title } : {}),
          text,
        };

    const res = await fetch(this.credential.incoming_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return { ok: res.ok };
  }
}

export function createTeamsClient(credential: Credential, options: Options): TeamsClient {
  return new TeamsClient(credential, options);
}
