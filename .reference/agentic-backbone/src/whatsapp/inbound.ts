import type { BackboneEventBus } from '../events/index.js';
import type { InboundMessage } from './types.js';

/**
 * Handler unificado para mensagens WhatsApp inbound.
 * Ambos os webhooks (Evolution e Laravel) convergem aqui.
 */
export function handleInboundMessage(msg: InboundMessage, eventBus: BackboneEventBus): void {
  console.log(
    `[whatsapp] inbound: source=${msg.source} phone=${msg.phone} type=${msg.messageType}`,
  );
  eventBus.emit('whatsapp:message-received', { ts: Date.now(), ...msg });
}
