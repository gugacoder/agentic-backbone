/**
 * Notification Gateway — backbone-native wrapper
 *
 * Outbound direto: backbone → notification-gateway → Laravel → WhatsApp
 * Sem dependencia do cia-api em runtime.
 *
 * Cria pools proprio (pg + mysql) usando as mesmas env vars dos adapters builtin.
 * O notification-gateway espera um pg.Pool raw (chama db.query() e le .rows),
 * entao nao podemos reusar o adapter connector (que retorna apenas rows).
 */

import pg from 'pg';
import { createPool, type Pool as MysqlPool } from 'mysql2/promise';
import {
  sendMessage,
  createWhatsappChannel,
} from '@cia/notification-gateway';
import type {
  ContactRef,
  SendMessageOptions,
  SendMessageResult,
  GatewayChannels,
} from '@cia/notification-gateway';

const { Pool: PgPool } = pg;

// Re-export for convenience
export type { ContactRef, SendMessageOptions, SendMessageResult };

// ─── Lazy-initialized pools ──────────────────────────────────────────────────

let _pgPool: InstanceType<typeof PgPool> | null = null;
let _mysqlPool: MysqlPool | null = null;

function getPgPool(): InstanceType<typeof PgPool> {
  if (!_pgPool) {
    _pgPool = new PgPool({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 3,
    });
  }
  return _pgPool;
}

function getMysqlPool(): MysqlPool {
  if (!_mysqlPool) {
    _mysqlPool = createPool({
      host: process.env.MYSQL_CIA_PRIME_HOST,
      port: Number(process.env.MYSQL_CIA_PRIME_PORT),
      database: process.env.MYSQL_CIA_PRIME_DATABASE,
      user: process.env.MYSQL_CIA_PRIME_USER,
      password: process.env.MYSQL_CIA_PRIME_PASSWORD,
      waitForConnections: true,
      connectionLimit: 3,
      dateStrings: true,
    });
  }
  return _mysqlPool;
}

// ─── Resolucao de telefone (MySQL cia_prime) ─────────────────────────────────

type PhoneRow = { phone: string | null; ddi: string | null };

async function resolvePhone(ref: ContactRef): Promise<string | null> {
  try {
    let rows: PhoneRow[];
    const contactType: string = ref.type;

    switch (contactType) {
      case 'funcionario': {
        const [r] = await getMysqlPool().query(
          'SELECT num_celular AS phone, NULL AS ddi FROM funcionarios WHERE id = ? LIMIT 1',
          [ref.id],
        );
        rows = r as unknown as PhoneRow[];
        break;
      }
      case 'cliente':
      case 'responsavel':
      case 'contratantes': {
        const [r] = await getMysqlPool().query(
          'SELECT num_celular AS phone, NULL AS ddi FROM contratantes WHERE id = ? LIMIT 1',
          [ref.id],
        );
        rows = r as unknown as PhoneRow[];
        break;
      }
      case 'familiar': {
        const [r] = await getMysqlPool().query(
          'SELECT whatsapp AS phone, origem_telefone AS ddi FROM assistido_comunicacao WHERE id = ? LIMIT 1',
          [ref.id],
        );
        rows = r as unknown as PhoneRow[];
        break;
      }
      case 'propostas': {
        const [r] = await getMysqlPool().query(
          'SELECT whatsapp_celular AS phone, NULL AS ddi FROM propostas WHERE id = ? LIMIT 1',
          [ref.id],
        );
        rows = r as unknown as PhoneRow[];
        break;
      }
      case 'candidato-contratante': {
        const [r] = await getMysqlPool().query(
          'SELECT num_celular AS phone, origem_telefone AS ddi FROM candidato_contratantes WHERE id = ? LIMIT 1',
          [ref.id],
        );
        rows = r as unknown as PhoneRow[];
        break;
      }
      case 'candidato-curriculo': {
        const [r] = await getMysqlPool().query(
          'SELECT telefone AS phone, NULL AS ddi FROM curriculo_candidato WHERE id = ? LIMIT 1',
          [ref.id],
        );
        rows = r as unknown as PhoneRow[];
        break;
      }
      default:
        return null;
    }

    const row = rows[0];
    if (!row?.phone) return null;

    const ddi = (row.ddi ?? '').replace(/[^0-9]/g, '');
    const number = row.phone.replace(/[^0-9]/g, '');
    if (!number) return null;

    if (ddi) return ddi + number;
    if (number.startsWith('55') && number.length >= 12) return number;
    return '55' + number;
  } catch {
    return null;
  }
}

// ─── Canal WhatsApp via Laravel ──────────────────────────────────────────────

const LARAVEL_URL = process.env.LARAVEL_URL || `http://localhost:${process.env.LARAVEL_PORT}`;
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';

function createLaravelWhatsappChannel(tenantId: number): GatewayChannels['whatsapp'] {
  return createWhatsappChannel({
    resolvePhone,
    sendText: async (phone, message) => {
      const res = await fetch(
        `${LARAVEL_URL}/api/meta-api/gateway/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `System ${INTERNAL_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            number: phone,
            tenant_id: tenantId,
            message,
          }),
        },
      );
      return res.ok;
    },
  });
}

// ─── Default dialect from DB ─────────────────────────────────────────────────

type WhatsappDialect = 'laravel' | 'evolution';

let _dialectCache: { value: WhatsappDialect; ts: number } | null = null;

async function getDefaultDialect(): Promise<WhatsappDialect> {
  if (_dialectCache && Date.now() - _dialectCache.ts < 30_000) return _dialectCache.value;
  try {
    const { rows } = await getPgPool().query(
      'SELECT whatsapp_dialect FROM cia.notif_global_mode WHERE id = 1',
    );
    const value = (rows[0]?.whatsapp_dialect as WhatsappDialect) ?? 'laravel';
    _dialectCache = { value, ts: Date.now() };
    return value;
  } catch {
    return 'laravel';
  }
}

// ─── API publica ─────────────────────────────────────────────────────────────

export interface GatewayOptions extends SendMessageOptions {
  dialect?: WhatsappDialect;
  tenantId?: number;
}

export async function gateway(opts: GatewayOptions): Promise<SendMessageResult> {
  const dialect = opts.dialect ?? await getDefaultDialect();

  // Evolution nao suportado no backbone (sem evolutionService) — fallback para laravel
  const whatsappChannel = createLaravelWhatsappChannel(opts.tenantId ?? 0);

  if (dialect === 'evolution') {
    console.warn('[gateway] evolution dialect not supported in backbone — using laravel');
  }

  const channels: GatewayChannels = {
    whatsapp: whatsappChannel,
    // email nao suportado no backbone (sem SMTP config) — omitido
  };

  return sendMessage(opts, getPgPool() as unknown as pg.Pool, channels);
}
