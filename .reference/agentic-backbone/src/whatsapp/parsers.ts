import type { InboundMessage } from './types.js';

// =============================================================================
// Utility functions (copiadas de cia-api/src/types/webhook.ts — puras, sem deps)
// =============================================================================

function extractPhoneFromJid(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
}

function extractTextFromMessage(msg: Record<string, unknown> | undefined): string | null {
  if (!msg) return null;

  return (
    (msg.conversation as string) ||
    (msg.extendedTextMessage as Record<string, unknown> | undefined)?.text as string ||
    (msg.imageMessage as Record<string, unknown> | undefined)?.caption as string ||
    (msg.videoMessage as Record<string, unknown> | undefined)?.caption as string ||
    (msg.buttonsResponseMessage as Record<string, unknown> | undefined)?.selectedDisplayText as string ||
    (msg.listResponseMessage as Record<string, unknown> | undefined)?.description as string ||
    null
  );
}

type MessageType = InboundMessage['messageType'];

function getMessageType(msg: Record<string, unknown> | undefined, fallbackType?: string): MessageType {
  if (!msg) return 'unknown';

  if (msg.conversation || msg.extendedTextMessage) return 'text';
  if (msg.imageMessage) return 'image';
  if (msg.audioMessage) {
    return (msg.audioMessage as Record<string, unknown>)?.ptt ? 'ptt' : 'audio';
  }
  if (msg.documentMessage) return 'document';
  if (msg.videoMessage) return 'video';
  if (msg.locationMessage) return 'location';
  if (msg.contactMessage) return 'contact';
  if (msg.buttonsResponseMessage) return 'button_response';
  if (msg.listResponseMessage) return 'list_response';
  if (msg.reactionMessage) return 'reaction';

  const ft = fallbackType as MessageType | undefined;
  if (ft && ft !== 'unknown') return ft;

  return 'unknown';
}

// =============================================================================
// Parsers
// =============================================================================

/**
 * Parseia payload do Evolution webhook (messages.upsert) para InboundMessage.
 *
 * Espera o body completo do webhook: { event, instance, data: { key, message, pushName, ... } }
 */
export function parseEvolutionInbound(body: Record<string, unknown>): InboundMessage | null {
  const data = body.data as Record<string, unknown> | undefined;
  if (!data) return null;

  const key = data.key as Record<string, unknown> | undefined;
  if (!key) return null;

  // Ignorar mensagens enviadas (fromMe)
  if (key.fromMe) return null;

  const remoteJid = key.remoteJid as string | undefined;
  if (!remoteJid) return null;

  const msg = data.message as Record<string, unknown> | undefined;

  return {
    source: 'evolution',
    phone: extractPhoneFromJid(remoteJid),
    tenantId: null,
    text: extractTextFromMessage(msg),
    messageType: getMessageType(msg, data.messageType as string | undefined),
    pushName: (data.pushName as string) || null,
    messageId: (key.id as string) || null,
    timestamp: data.messageTimestamp
      ? new Date((data.messageTimestamp as number) * 1000)
      : new Date(),
    instance: (body.instance as string) || null,
    raw: body,
  };
}

/**
 * Parseia payload do Laravel webhook para InboundMessage.
 *
 * Espera: { event, wa_id, tenant_id?, message? }
 */
export function parseLaravelInbound(body: Record<string, unknown>): InboundMessage | null {
  const waId = body.wa_id as string | undefined;
  if (!waId) return null;

  return {
    source: 'laravel',
    phone: waId,
    tenantId: (body.tenant_id as number) ?? null,
    text: (body.message as string) ?? null,
    messageType: 'text',
    pushName: null,
    messageId: null,
    timestamp: new Date(),
    instance: null,
    raw: body,
  };
}
