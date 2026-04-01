import { Hono } from "hono";
import { connectorRegistry } from "../connectors/index.js";
import { credentialSchema, optionsSchema } from "../connectors/email/schemas.js";
import { createEmailClient } from "../connectors/email/client.js";
import { pollingStatus, loadState } from "../connectors/email/channel-adapter.js";

export const emailRoutes = new Hono();

/**
 * POST /adapters/email/:adapterId/test
 * Test IMAP and SMTP connectivity separately, returning latency for each.
 */
emailRoutes.post("/adapters/email/:adapterId/test", async (c) => {
  const { adapterId } = c.req.param();

  const adapter = connectorRegistry.findAdapter(adapterId);
  if (!adapter) {
    return c.json({ error: `Adapter "${adapterId}" not found` }, 404);
  }

  if (adapter.connector !== "email") {
    return c.json({ error: `Adapter "${adapterId}" is not an email adapter` }, 400);
  }

  const credResult = credentialSchema.safeParse(adapter.credential);
  const optsResult = optionsSchema.safeParse(adapter.options);

  if (!credResult.success || !optsResult.success) {
    return c.json({ error: "Invalid adapter credential or options" }, 422);
  }

  const client = createEmailClient(credResult.data, optsResult.data);

  const [imapResult, smtpResult] = await Promise.all([client.testImap(), client.testSmtp()]);

  return c.json({
    imap: imapResult,
    smtp: smtpResult,
  });
});

/**
 * GET /adapters/email/:adapterId/status
 * Returns polling status, last execution time, emails processed today, and last error.
 */
emailRoutes.get("/adapters/email/:adapterId/status", (c) => {
  const { adapterId } = c.req.param();

  const adapter = connectorRegistry.findAdapter(adapterId);
  if (!adapter) {
    return c.json({ error: `Adapter "${adapterId}" not found` }, 404);
  }

  if (adapter.connector !== "email") {
    return c.json({ error: `Adapter "${adapterId}" is not an email adapter` }, 400);
  }

  // Try in-memory status first (populated when polling is running)
  const inMemory = pollingStatus.get(adapterId);

  if (inMemory) {
    return c.json({
      adapterId,
      polling: inMemory.polling,
      lastPollAt: inMemory.lastPollAt,
      processedToday: inMemory.processedToday,
      lastError: inMemory.lastError,
    });
  }

  // Fallback to persistent state on disk
  const state = loadState(adapterId);
  return c.json({
    adapterId,
    polling: false,
    lastPollAt: state.lastPollAt,
    processedToday: state.processedToday,
    lastError: state.lastError,
  });
});
