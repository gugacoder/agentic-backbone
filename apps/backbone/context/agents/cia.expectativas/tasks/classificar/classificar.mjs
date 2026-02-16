#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// classificar.mjs — Classificação de guardiões por taxa de falha
//
// Cruza 7 dias de escalas × interval_configs × pontos para calcular
// taxa de falha por checkpoint de cada guardião. Classifica em
// verde/amarelo/vermelho e detecta mudanças de faixa.
//
// Uso:
//   node classificar.mjs                  # executa classificação
//   node classificar.mjs --migrate        # cria tabelas no cia_app
//   node classificar.mjs --dry-run        # calcula sem persistir
//   node classificar.mjs --date 2025-11-14 --dry-run  # data de referência
//
// Output: JSON com classificações e mudanças de faixa.
// ══════════════════════════════════════════════════════════════════

import { createAdapter } from '../../../../shared/connectors/mysql/adapter.mjs';
import { randomUUID } from 'crypto';

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const prime = createAdapter(__dirname + '/../../../../shared/adapters/cia-prime');
const app = createAdapter(__dirname + '/../../../../shared/adapters/cia-app');
const queryPrime = prime.query;
const queryApp = app.query;
const mutateApp = app.mutate;
const closePrime = prime.close;
const closeApp = app.close;

// ── CLI args ────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isMigrate = args.includes('--migrate');
const isDryRun = args.includes('--dry-run');
const dateIdx = args.indexOf('--date');
const REF_DATE = dateIdx !== -1 ? args[dateIdx + 1] : null;

// ── Config ──────────────────────────────────────────────────────

const GREEN_THRESHOLD = 10;   // 0-10% falha → verde
const YELLOW_THRESHOLD = 50;  // 11-50% falha → amarelo, >50% → vermelho
const LOOKBACK_DAYS = 7;
const TENANT_ID = 1;

// ── Database pools (via adapter connect.mjs) ────────────────────

// ── SQL date helpers ────────────────────────────────────────────

/** Returns SQL expression for the reference date (CURDATE() or literal). */
function sqlDate() {
  return REF_DATE ? `'${REF_DATE}'` : 'CURDATE()';
}

function sqlDateSub(days) {
  return `DATE_SUB(${sqlDate()}, INTERVAL ${days} DAY)`;
}

// ── DDL ─────────────────────────────────────────────────────────

const DDL_GUARDIAN_EXPECTATIONS = `
CREATE TABLE IF NOT EXISTS guardian_expectations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  funcionario_id VARCHAR(36) NOT NULL,
  funcionario_nome VARCHAR(255) NOT NULL,
  category ENUM('green', 'yellow', 'red') NOT NULL DEFAULT 'green',
  failure_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  failures_count INT NOT NULL DEFAULT 0,
  opportunities_count INT NOT NULL DEFAULT 0,
  previous_category ENUM('green', 'yellow', 'red') NULL,
  last_calculated_at DATETIME NULL,
  tenant_id INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_funcionario_tenant (funcionario_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function migrate() {
  await mutateApp(DDL_GUARDIAN_EXPECTATIONS);
  console.error('[migrate] guardian_expectations OK');
}

// ── Queries ─────────────────────────────────────────────────────

/** Q1 — Guardiões com escala ativa na data de referência */
async function fetchActiveGuardians() {
  return queryPrime(`
    SELECT DISTINCT
      f.id            AS funcionario_id,
      f.nome          AS funcionario_nome,
      f.num_celular   AS celular
    FROM calendario_escalas ce
    JOIN funcionarios f ON f.id = ce.funcionario_id
    WHERE DATE(ce.startDate) <= ${sqlDate()}
      AND DATE(ce.endDate) >= ${sqlDate()}
      AND f.ativo = 1
      AND ce.tenant_id = ${TENANT_ID}
    ORDER BY f.nome
  `);
}

/** Fetch interval_configs (cached per run) */
async function fetchIntervalConfigs() {
  return queryPrime('SELECT `interval`, start, end FROM interval_configs');
}

/** Fetch shift history in the lookback window for a guardian */
async function fetchShifts(funcionarioId) {
  return queryPrime(`
    SELECT
      ce.startDate,
      ce.endDate
    FROM calendario_escalas ce
    WHERE ce.funcionario_id = '${funcionarioId}'
      AND ce.startDate >= ${sqlDateSub(LOOKBACK_DAYS)}
      AND ce.startDate < ${sqlDate()}
      AND ce.tenant_id = ${TENANT_ID}
    ORDER BY ce.startDate
  `);
}

/** Q3 — Pontos no período de lookback */
async function fetchPontos(funcionarioId) {
  return queryPrime(`
    SELECT
      p.tipo,
      p.tipo_intervalo,
      DATE(p.data_hora) AS dia,
      TIME(p.data_hora) AS hora
    FROM pontos p
    WHERE p.funcionario_id = '${funcionarioId}'
      AND p.data_hora >= ${sqlDateSub(LOOKBACK_DAYS)}
      AND p.data_hora < ${sqlDate()}
    ORDER BY p.data_hora
  `);
}

/** Q6 — Current classifications from cia_app */
async function fetchCurrentClassifications() {
  const rows = await queryApp(`
    SELECT funcionario_id, category, failure_rate
    FROM guardian_expectations
    WHERE tenant_id = ?
  `, [TENANT_ID]);
  const map = new Map();
  for (const row of rows) {
    map.set(row.funcionario_id, row);
  }
  return map;
}

// ── Classification logic ────────────────────────────────────────

/**
 * Parse a MySQL TIME string "HH:MM:SS" to minutes since midnight.
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const str = String(timeStr);
  const parts = str.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

/**
 * Extract HH:MM:SS from a Date or datetime string.
 */
function formatTime(dt) {
  if (dt instanceof Date) {
    return dt.toTimeString().slice(0, 8);
  }
  const str = String(dt);
  if (str.includes(' ')) return str.split(' ')[1];
  return str;
}

/**
 * Given a shift (startDate, endDate) and interval_configs,
 * determine expected checkpoint count.
 *
 * Always expected: entrada plantao (start) + saida plantao (end) = 2
 * For each interval that overlaps the shift: +2 (saida [interval] + entrada NULL)
 */
function countExpectedCheckpoints(shift, intervalConfigs) {
  const shiftStart = timeToMinutes(formatTime(shift.startDate));
  const shiftEnd = timeToMinutes(formatTime(shift.endDate));
  const isOvernight = shiftEnd <= shiftStart;

  let count = 2; // entrada plantao + saida plantao

  for (const ic of intervalConfigs) {
    const icStart = timeToMinutes(ic.start);
    const icEnd = timeToMinutes(ic.end);

    let overlaps = false;
    if (isOvernight) {
      // Shift wraps midnight: e.g. 19:00 → 07:00
      // Interval overlaps if any part falls in [shiftStart..23:59] or [00:00..shiftEnd]
      overlaps = icStart >= shiftStart || icEnd <= shiftEnd;
    } else {
      // Normal shift: e.g. 07:00 → 19:00
      overlaps = icStart < shiftEnd && icEnd > shiftStart;
    }

    if (overlaps) {
      count += 2; // saida [interval] + entrada NULL (return)
    }
  }

  return count;
}

/**
 * Classify a failure rate into a category.
 */
function classify(failureRate) {
  if (failureRate <= GREEN_THRESHOLD) return 'green';
  if (failureRate <= YELLOW_THRESHOLD) return 'yellow';
  return 'red';
}

/**
 * Process a single guardian: calculate failure rate and classify.
 */
async function classifyGuardian(guardian, intervalConfigs) {
  const shifts = await fetchShifts(guardian.funcionario_id);
  const pontos = await fetchPontos(guardian.funcionario_id);

  if (shifts.length === 0) {
    return {
      funcionario_id: guardian.funcionario_id,
      funcionario_nome: guardian.funcionario_nome,
      category: 'green',
      failure_rate: 0,
      failures_count: 0,
      opportunities_count: 0,
      skipped: true,
      reason: 'no_shifts_in_window',
    };
  }

  let totalExpected = 0;
  for (const shift of shifts) {
    totalExpected += countExpectedCheckpoints(shift, intervalConfigs);
  }

  const totalRealized = pontos.length;
  const failures = Math.max(0, totalExpected - totalRealized);
  const failureRate = totalExpected > 0
    ? (failures / totalExpected) * 100
    : 0;

  return {
    funcionario_id: guardian.funcionario_id,
    funcionario_nome: guardian.funcionario_nome,
    category: classify(failureRate),
    failure_rate: Math.round(failureRate * 100) / 100,
    failures_count: failures,
    opportunities_count: totalExpected,
    pontos_count: totalRealized,
    shifts_count: shifts.length,
  };
}

// ── Persistence ─────────────────────────────────────────────────

async function upsertClassification(result) {
  const id = randomUUID();
  await mutateApp(`
    INSERT INTO guardian_expectations
      (id, funcionario_id, funcionario_nome, category,
       failure_rate, failures_count, opportunities_count,
       previous_category, last_calculated_at, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NOW(), ?)
    ON DUPLICATE KEY UPDATE
      previous_category = category,
      category = VALUES(category),
      failure_rate = VALUES(failure_rate),
      failures_count = VALUES(failures_count),
      opportunities_count = VALUES(opportunities_count),
      last_calculated_at = NOW()
  `, [
    id,
    result.funcionario_id,
    result.funcionario_nome,
    result.category,
    result.failure_rate,
    result.failures_count,
    result.opportunities_count,
    TENANT_ID,
  ]);
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  const useApp = isMigrate || !isDryRun;

  try {
    // Migrate if requested
    if (isMigrate) {
      await migrate();
      if (args.filter(a => a !== '--migrate').length === 0) {
        console.log(JSON.stringify({ status: 'migrated' }));
        return;
      }
    }

    console.error(`[classificar] Data de referência: ${REF_DATE || 'hoje'}`);

    // 1. Fetch interval configs (shared across all guardians)
    const intervalConfigs = await fetchIntervalConfigs();

    // 2. Fetch active guardians
    const guardians = await fetchActiveGuardians();
    console.error(`[classificar] ${guardians.length} guardiões com escala ativa`);

    if (guardians.length === 0) {
      console.log(JSON.stringify({
        status: 'ok',
        date: REF_DATE || new Date().toISOString().slice(0, 10),
        classifications: [],
        band_changes: [],
        summary: { green: 0, yellow: 0, red: 0, total: 0 },
      }));
      return;
    }

    // 3. Fetch current classifications for band change detection
    let currentMap = new Map();
    if (useApp) {
      try {
        currentMap = await fetchCurrentClassifications();
      } catch (err) {
        console.error(`[classificar] Aviso: não foi possível ler classificações atuais: ${err.message}`);
      }
    }

    // 4. Classify each guardian
    const classifications = [];
    const bandChanges = [];

    for (const guardian of guardians) {
      const result = await classifyGuardian(guardian, intervalConfigs);
      if (result.skipped) {
        classifications.push(result);
        continue;
      }

      // Detect band change
      const current = currentMap.get(guardian.funcionario_id);
      if (current && current.category !== result.category) {
        bandChanges.push({
          funcionario_id: guardian.funcionario_id,
          funcionario_nome: guardian.funcionario_nome,
          celular: guardian.celular || null,
          from: current.category,
          to: result.category,
          direction: categoryRank(result.category) < categoryRank(current.category) ? 'improved' : 'worsened',
        });
      }

      // Persist
      if (!isDryRun) {
        try {
          await upsertClassification(result);
        } catch (err) {
          console.error(`[classificar] Erro ao persistir ${guardian.funcionario_nome}: ${err.message}`);
          result.persist_error = err.message;
        }
      }

      classifications.push(result);
    }

    // 5. Summary
    const summary = { green: 0, yellow: 0, red: 0, total: 0 };
    for (const c of classifications) {
      if (!c.skipped) {
        summary[c.category]++;
        summary.total++;
      }
    }

    const output = {
      status: 'ok',
      date: REF_DATE || new Date().toISOString().slice(0, 10),
      dry_run: isDryRun,
      classifications,
      band_changes: bandChanges,
      summary,
    };

    console.log(JSON.stringify(output, null, 2));

  } finally {
    await closePrime();
    await closeApp();
  }
}

function categoryRank(cat) {
  return { green: 0, yellow: 1, red: 2 }[cat] ?? 1;
}

main().catch(err => {
  console.error(`[classificar] Fatal: ${err.message}`);
  process.exit(1);
});
