/**
 * Tipo normalizado para mensagens WhatsApp inbound.
 * Ambos os webhooks (Evolution e Laravel) convergem para este formato.
 */
export interface InboundMessage {
  /** Origem do webhook */
  source: 'evolution' | 'laravel';
  /** Numero WhatsApp (so digitos, com DDI). Ex: "5511999998888" */
  phone: string;
  /** Tenant ID (quando disponivel) */
  tenantId: number | null;
  /** Texto da mensagem (null para midia sem caption) */
  text: string | null;
  /** Tipo da mensagem */
  messageType:
    | 'text'
    | 'image'
    | 'audio'
    | 'ptt'
    | 'video'
    | 'document'
    | 'location'
    | 'contact'
    | 'button_response'
    | 'list_response'
    | 'reaction'
    | 'unknown';
  /** Nome do remetente (pushName do Evolution, null do Laravel) */
  pushName: string | null;
  /** ID da mensagem no WhatsApp (quando disponivel) */
  messageId: string | null;
  /** Timestamp da mensagem */
  timestamp: Date;
  /** Instancia Evolution (quando disponivel) */
  instance: string | null;
  /** Payload original cru (para handlers que precisam de dados extras) */
  raw: unknown;
}
