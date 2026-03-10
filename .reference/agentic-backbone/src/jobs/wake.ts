import { triggerManualHeartbeat } from "../heartbeat/index.js";
import { sendMessage, getSession, createSession } from "../conversations/index.js";
import type { JobSession } from "./types.js";

const WAKE_TIMEOUT_MS = 10 * 60 * 1000; // 10min

export async function wakeAgentForJob(session: JobSession): Promise<void> {
  if (session.wakeMode === "conversation" && session.sessionId && session.userId) {
    await wakeConversation(session);
  } else {
    await triggerManualHeartbeat(session.agentId);
  }
}

async function wakeConversation(session: JobSession): Promise<void> {
  const { agentId, userId, wakeContext } = session;
  let sessionId = session.sessionId!;

  // Build wake message with job result
  const statusLine = session.status === "completed"
    ? `Job **${session.id}** completed (exit ${session.exitCode}, ${session.durationMs}ms)`
    : `Job **${session.id}** ${session.status} (exit ${session.exitCode}, signal ${session.exitSignal}, ${session.durationMs}ms)`;

  let message = `[job:wake] ${statusLine}`;

  if (session.tail) {
    message += `\n\n<job_output>\n${session.tail}\n</job_output>`;
  }

  if (wakeContext) {
    message += `\n\n<job_context>\n${wakeContext}\n</job_context>`;
  }

  // Validate/recreate session if needed (same pattern as cron/executor.ts)
  let existing = getSession(sessionId);
  if (!existing) {
    existing = createSession(userId!, agentId);
    sessionId = existing.session_id;
  }

  // Set AGENT_ID for the conversation pipeline
  process.env.AGENT_ID = agentId;

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("job wake timeout")), WAKE_TIMEOUT_MS);
  });

  const execution = (async () => {
    for await (const event of sendMessage(userId!, sessionId, message)) {
      // Consume the async generator — responses flow to the conversation
      if (event.type === "result" || event.type === "text" || event.type === "usage") {
        // noop — just drain
      }
    }
  })();

  try {
    await Promise.race([execution, timeout]);
    console.log(`[jobs] wake conversation done for ${session.id} (agent=${agentId}, session=${sessionId})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[jobs] wake conversation failed for ${session.id}: ${msg}`);
  }
}
