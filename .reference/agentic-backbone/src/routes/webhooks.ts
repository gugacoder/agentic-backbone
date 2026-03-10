/**
 * POST /webhooks/whatsapp/inbound
 *
 * Recebe mensagens WhatsApp encaminhadas pelo Laravel.
 * Autenticacao: Authorization: System <INTERNAL_SERVICE_KEY>
 *
 * Montado ANTES do JWT barrier — usa auth propria (INTERNAL_SERVICE_KEY).
 * Endpoint final: POST /api/v2/agents/webhooks/whatsapp/inbound
 */

import { Hono } from 'hono';
import { eventBus } from '../events/index.js';
import { parseLaravelInbound } from '../whatsapp/parsers.js';
import { handleInboundMessage } from '../whatsapp/inbound.js';

const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';

export const webhookRoutes = new Hono();

webhookRoutes.post('/webhooks/whatsapp/inbound', async (c) => {
  // 1. Validate Authorization
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('System ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice('System '.length);
  if (!INTERNAL_SERVICE_KEY || token !== INTERNAL_SERVICE_KEY) {
    return c.json({ error: 'Invalid service key' }, 401);
  }

  // 2. Parse body
  const body = await c.req.json<{
    event?: string;
    wa_id?: string;
    tenant_id?: number;
    message?: string;
  }>();

  if (!body.event || !body.wa_id) {
    return c.json({ error: 'Missing required fields: event, wa_id' }, 400);
  }

  // 3. Parse + emit via handler unificado
  const msg = parseLaravelInbound(body as Record<string, unknown>);
  if (msg) {
    handleInboundMessage(msg, eventBus);
  }

  // 4. Respond quickly — Laravel has a 2s timeout
  return c.json({
    consumed: true,
    skip_processing: false,
  });
});
