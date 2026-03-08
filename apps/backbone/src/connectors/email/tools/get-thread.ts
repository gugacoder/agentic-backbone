import { tool } from "ai";
import { z } from "zod";

export function createEmailGetThreadTool(slugs: [string, ...string[]]): Record<string, any> {
  return {
    get_email_thread: tool({
      description:
        "Retrieve the full message history for an email thread. Given a Message-ID from any message in the thread, returns all emails in that thread sorted by date.",
      parameters: z.object({
        adapter: z.enum(slugs).describe("Email adapter slug"),
        messageId: z.string().describe("Message-ID of any email in the thread"),
      }),
      execute: async (args) => {
        try {
          const { loadState } = await import("../channel-adapter.js");
          const state = loadState(args.adapter);

          // Find the session for this messageId
          const sessionId = state.threadMap[args.messageId];
          if (!sessionId) {
            return {
              messages: [],
              note: `No thread found for Message-ID "${args.messageId}"`,
            };
          }

          // Collect all messageIds that belong to the same session
          const index = state.emailIndex ?? {};
          const messages = Object.entries(state.threadMap)
            .filter(([, sid]) => sid === sessionId)
            .map(([mid]) => {
              const data = index[mid];
              if (data) {
                return {
                  messageId: mid,
                  from: data.from,
                  date: data.date,
                  subject: data.subject,
                  body: data.body,
                };
              }
              return { messageId: mid, from: null, date: null, subject: null, body: null };
            })
            .sort((a, b) => {
              if (!a.date) return 1;
              if (!b.date) return -1;
              return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
            });

          return { sessionId, messages };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
