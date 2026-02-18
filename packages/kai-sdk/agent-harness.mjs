#!/usr/bin/env node
// =============================================================================
// Ralph Wiggum Loop — Claude Code (MJS)
// Script autocontido do loop unificado. Apenas node: built-ins.
//
// Invocação:
//   node agent-harness.mjs
//
// Env overrides:
//   MAX_TURNS, MAX_ITERATIONS, MAX_FEATURES, MODEL
//
// Graceful stop:
//   touch .stop
// =============================================================================

import { readFile, writeFile, appendFile, mkdir, access, unlink, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';

// --- Cores ---
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const CYAN = '\x1b[0;36m';
const NC = '\x1b[0m';

// --- Utilitários ---
function now() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// --- Carregar config ---
async function loadConfig() {
  const configPath = resolve('agent-harness.json');
  if (!await fileExists(configPath)) {
    throw new Error('agent-harness.json não encontrado no diretório corrente.');
  }
  return readJson(configPath);
}

// --- Features ---
async function loadFeatures(featuresPath) {
  const data = await readJson(featuresPath);
  return Array.isArray(data) ? data : data.features;
}

async function saveFeatures(featuresPath, features) {
  await writeJson(featuresPath, features);
}

function selectNextFeature(features) {
  const passingIds = new Set(
    features.filter(f => f.status === 'passing').map(f => f.id)
  );

  const eligible = features
    .filter(f => f.status === 'pending' || f.status === 'failing')
    .filter(f => !f.dependencies || f.dependencies.every(d => passingIds.has(d)))
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));

  return eligible[0] || null;
}

function computeBlocked(features) {
  const passingIds = new Set(
    features.filter(f => f.status === 'passing').map(f => f.id)
  );

  for (const f of features) {
    if (f.dependencies && f.dependencies.length > 0) {
      const depsOk = f.dependencies.every(d => passingIds.has(d));
      if (!depsOk && (f.status === 'pending' || f.status === 'failing')) {
        f.status = 'blocked';
      } else if (depsOk && f.status === 'blocked') {
        f.status = 'pending';
      }
    }
  }
}

function countByStatus(features) {
  const counts = { pending: 0, in_progress: 0, failing: 0, blocked: 0, skipped: 0, passing: 0 };
  for (const f of features) {
    counts[f.status] = (counts[f.status] || 0) + 1;
  }
  return counts;
}

// --- Resiliência e gutter detection ---
async function appendProgress(progressPath, line) {
  await appendFile(progressPath, line + '\n', 'utf8');
}

function executeRollback(mode, featureId) {
  const ts = now();
  if (mode === 'stash') {
    const msg = `gutter-${featureId}-${ts.replace(/[:.]/g, '')}`;
    try {
      execSync(`git stash push -m "${msg}"`, { stdio: 'pipe' });
      return `[ROLLBACK] git stash push -m "${msg}"`;
    } catch {
      return `[ROLLBACK] git stash falhou (nada para stash?)`;
    }
  } else if (mode === 'reset') {
    try {
      execSync('git reset --hard HEAD', { stdio: 'pipe' });
      return '[ROLLBACK] git reset --hard HEAD executado';
    } catch {
      return '[ROLLBACK] git reset --hard HEAD falhou';
    }
  } else if (mode === 'none') {
    return '[ROLLBACK] none — sem rollback configurado';
  }
  return '[ROLLBACK] modo desconhecido — sem rollback';
}

async function writeGuardrails(guardrailsPath, featureId, retries, action, result) {
  const ts = now();
  const entry = `\n## ${ts} — Feature ${featureId}\n\n- **Problema:** ${retries} falhas consecutivas na implementação\n- **Ação:** ${action}\n- **Resultado:** ${result}\n`;

  if (await fileExists(guardrailsPath)) {
    await appendFile(guardrailsPath, entry, 'utf8');
  } else {
    const header = '# Guardrails — Lições Aprendidas\n';
    await writeFile(guardrailsPath, header + entry, 'utf8');
  }
}

// --- Webhooks e notificações ---
async function notifyWebhooks(config, progressPath, event, data) {
  const notifications = config.notifications;
  if (!Array.isArray(notifications) || notifications.length === 0) return;

  const matching = notifications.filter(n =>
    Array.isArray(n.events) && (n.events.includes(event) || n.events.includes('*'))
  );
  if (matching.length === 0) return;

  const payload = {
    event,
    timestamp: now(),
    project: {
      slug: config.slug || '',
      name: config.name || '',
    },
    data,
  };

  const body = JSON.stringify(payload);

  for (const webhook of matching) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const logLine = `[${now()}] [WEBHOOK] POST ${webhook.url} → ${response.status}`;
      await appendProgress(progressPath, logLine);
    } catch (err) {
      const logLine = `[${now()}] [WEBHOOK] POST ${webhook.url} → ERRO: ${err.message}`;
      await appendProgress(progressPath, logLine);
    }
  }
}

// --- State (observabilidade) ---
async function writeState(statePath, data) {
  await writeJson(statePath, data);
}

function makeState(overrides) {
  return {
    status: 'starting',
    iteration: 0,
    max_iterations: null,
    total: 0,
    done: 0,
    remaining: 0,
    feature_id: '',
    features_done: 0,
    max_features: null,
    started_at: '',
    updated_at: now(),
    exit_reason: '',
    ...overrides,
  };
}

// --- Spawn do agente ---
async function spawnAgent(config, featureId, sessionDir) {
  const commandPath = resolve('.claude', 'commands', 'vibe', 'code.md');
  if (!await fileExists(commandPath)) {
    throw new Error(`Command file não encontrado: ${commandPath}`);
  }

  const maxTurns = process.env.MAX_TURNS
    ? parseInt(process.env.MAX_TURNS, 10)
    : (config.agent.max_turns || 0);
  const model = process.env.MODEL || config.agent.model || '';

  const args = [
    '-p', '-',
    '--verbose',
    '--output-format', 'stream-json',
    '--allowedTools', 'Edit,Write,Bash,Read,Glob,Grep',
  ];
  if (maxTurns > 0) {
    args.push('--max-turns', String(maxTurns));
  }
  if (model) {
    args.push('--model', model);
  }

  const outputPath = join(sessionDir, 'output.jsonl');
  const outputStream = createWriteStream(outputPath, { flags: 'a' });

  return new Promise((resolvePromise, reject) => {
    const proc = spawn('claude', args, {
      cwd: resolve('.'),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    // Escrever PID da sessão
    writeFile(join(sessionDir, 'pid'), String(proc.pid) + '\n', 'utf8').catch(() => {});

    // Pipe stdin do command file
    readFile(commandPath, 'utf8').then(content => {
      proc.stdin.write(content);
      proc.stdin.end();
    }).catch(err => {
      proc.kill();
      reject(err);
    });

    // Capturar output
    proc.stdout.pipe(outputStream);
    proc.stderr.pipe(outputStream);

    proc.on('close', (code) => {
      outputStream.end();
      resolvePromise({ code, pid: proc.pid });
    });

    proc.on('error', (err) => {
      outputStream.end();
      reject(err);
    });
  });
}

// --- Main ---
async function main() {
  // 1. Carregar config
  const config = await loadConfig();
  const featuresPath = config.artifacts?.features || resolve('features.json');
  const statePath = config.artifacts?.state || resolve('agent-harness.state');
  const pidPath = config.artifacts?.pid || resolve('agent-harness.pid');
  const sessionsDir = config.artifacts?.sessions || resolve('.sessions');
  const progressPath = config.artifacts?.progress || resolve('agent-progress.txt');
  const guardrailsPath = resolve('agent-guardrails.md');
  const stopFile = resolve('.stop');

  // Resiliência
  const maxRetries = config.agent?.max_retries || 5;
  const rollbackMode = config.agent?.rollback || 'stash';

  // Env overrides
  const maxIterations = process.env.MAX_ITERATIONS
    ? parseInt(process.env.MAX_ITERATIONS, 10)
    : (config.agent.max_iterations || 0);
  const maxFeatures = process.env.MAX_FEATURES
    ? parseInt(process.env.MAX_FEATURES, 10)
    : (config.agent.max_features || 0);
  const sleepBetween = parseInt(process.env.SLEEP_BETWEEN || '5', 10);

  // 2. Verificar features.json
  if (!await fileExists(featuresPath)) {
    console.error(`${RED}features.json não encontrado: ${featuresPath}${NC}`);
    process.exit(1);
  }

  // 3. .stop residual — remover com aviso
  if (await fileExists(stopFile)) {
    console.log(`${YELLOW}AVISO: .stop residual encontrado. Removendo para iniciar.${NC}`);
    await unlink(stopFile);
  }

  // 4. Escrever PID
  await writeFile(pidPath, String(process.pid) + '\n', 'utf8');

  // 5. Estado inicial
  const loopStartedAt = now();
  let features = await loadFeatures(featuresPath);
  const total = features.length;
  const counts = countByStatus(features);

  const limitLabel = maxIterations === 0 ? '∞' : String(maxIterations);
  const featuresLimitLabel = maxFeatures === 0 ? '∞' : String(maxFeatures);

  console.log(`${CYAN}=======================================${NC}`);
  console.log(`${CYAN}  Ralph Wiggum Loop — Claude Code (MJS)${NC}`);
  console.log(`${CYAN}  Projeto: ${config.name || config.slug}${NC}`);
  console.log(`${CYAN}  Iterações: ${limitLabel}${NC}`);
  console.log(`${CYAN}  Max features: ${featuresLimitLabel}${NC}`);
  console.log(`${CYAN}  Para parar: touch .stop${NC}`);
  console.log(`${CYAN}=======================================${NC}`);
  console.log('');

  await writeState(statePath, makeState({
    status: 'starting',
    max_iterations: maxIterations || null,
    max_features: maxFeatures || null,
    total,
    done: counts.passing,
    remaining: total - counts.passing,
    started_at: loopStartedAt,
  }));

  // 6. Loop principal
  let iteration = 0;
  let featuresDone = 0;

  while (true) {
    iteration++;

    // 6a. Limite de iterações (0 = ilimitado)
    if (maxIterations > 0 && iteration > maxIterations) {
      console.log(`${RED}Limite de ${maxIterations} iterações atingido.${NC}`);
      await writeState(statePath, makeState({
        status: 'exited',
        iteration: iteration - 1,
        max_iterations: maxIterations || null,
        max_features: maxFeatures || null,
        total,
        done: countByStatus(features).passing,
        remaining: total - countByStatus(features).passing,
        features_done: featuresDone,
        started_at: loopStartedAt,
        exit_reason: 'iteration_limit',
      }));
      process.exit(1);
    }

    // 6b. Limite de features (0 = ilimitado)
    if (maxFeatures > 0 && featuresDone >= maxFeatures) {
      console.log(`${GREEN}Limite de ${maxFeatures} feature(s) completada(s) atingido.${NC}`);
      await writeState(statePath, makeState({
        status: 'exited',
        iteration: iteration - 1,
        max_iterations: maxIterations || null,
        max_features: maxFeatures || null,
        total,
        done: countByStatus(features).passing,
        remaining: total - countByStatus(features).passing,
        features_done: featuresDone,
        started_at: loopStartedAt,
        exit_reason: 'feature_limit',
      }));
      process.exit(0);
    }

    // 6c. Graceful stop check
    if (await fileExists(stopFile)) {
      console.log(`${YELLOW}Loop encerrado por .stop após iteração ${iteration - 1}.${NC}`);
      await notifyWebhooks(config, progressPath, 'stopped', {
        feature_id: null,
        feature_title: null,
        iteration: iteration - 1,
        features_done: featuresDone,
        features_total: total,
        exit_reason: 'stopped',
      });
      await writeState(statePath, makeState({
        status: 'exited',
        iteration: iteration - 1,
        max_iterations: maxIterations || null,
        max_features: maxFeatures || null,
        total,
        done: countByStatus(features).passing,
        remaining: total - countByStatus(features).passing,
        features_done: featuresDone,
        started_at: loopStartedAt,
        exit_reason: 'stopped',
      }));
      await unlink(stopFile).catch(() => {});
      process.exit(0);
    }

    // 6d. Recarregar features.json
    features = await loadFeatures(featuresPath);

    // 6e. Computar blocked
    computeBlocked(features);

    // 6f. Selecionar próxima feature elegível
    const next = selectNextFeature(features);

    if (!next) {
      // Verificar se todas estão passing
      const c = countByStatus(features);
      if (c.passing === features.length) {
        console.log('');
        console.log(`${GREEN}=======================================${NC}`);
        console.log(`${GREEN}  TODAS AS FEATURES IMPLEMENTADAS!${NC}`);
        console.log(`${GREEN}  Total: ${features.length} features${NC}`);
        console.log(`${GREEN}  Iterações: ${iteration - 1}${NC}`);
        console.log(`${GREEN}=======================================${NC}`);
        await notifyWebhooks(config, progressPath, 'completed', {
          feature_id: null,
          feature_title: null,
          iteration: iteration - 1,
          features_done: featuresDone,
          features_total: total,
          exit_reason: 'completed',
        });
        await writeState(statePath, makeState({
          status: 'exited',
          iteration: iteration - 1,
          max_iterations: maxIterations || null,
          max_features: maxFeatures || null,
          total,
          done: c.passing,
          remaining: 0,
          features_done: featuresDone,
          started_at: loopStartedAt,
          exit_reason: 'completed',
        }));
        process.exit(0);
      }

      console.log(`${RED}Nenhuma feature elegível (deps não satisfeitas). Abortando.${NC}`);
      await writeState(statePath, makeState({
        status: 'exited',
        iteration: iteration - 1,
        max_iterations: maxIterations || null,
        max_features: maxFeatures || null,
        total,
        done: c.passing,
        remaining: total - c.passing,
        features_done: featuresDone,
        started_at: loopStartedAt,
        exit_reason: 'deps_impossible',
      }));
      process.exit(1);
    }

    const featureId = next.id;
    const currentCounts = countByStatus(features);
    const done = currentCounts.passing;
    const remaining = total - done;

    console.log(`${YELLOW}--- Iteração ${iteration}/${limitLabel} | ${featureId} | Features: ${done}/${total} (faltam ${remaining}) ---${NC}`);

    // 6g. Marcar feature como in_progress
    next.status = 'in_progress';
    await saveFeatures(featuresPath, features);

    // 6h. Criar session dir
    const sessionDir = join(sessionsDir, featureId);
    await mkdir(sessionDir, { recursive: true });

    // Criar dirs do session_template (worktree, etc.)
    if (config.session_template?.dirs) {
      for (const dir of config.session_template.dirs) {
        await mkdir(join(sessionDir, dir), { recursive: true });
      }
    }

    // 6i. Registrar started_at
    const startedAt = now();
    await writeFile(join(sessionDir, 'started_at'), startedAt + '\n', 'utf8');

    // Escrever .current-feature
    const currentFeaturePath = join(sessionsDir, '.current-feature');
    await writeFile(currentFeaturePath, featureId + '\n', 'utf8');

    // 6j. Atualizar state → running
    await writeState(statePath, makeState({
      status: 'running',
      iteration,
      max_iterations: maxIterations || null,
      max_features: maxFeatures || null,
      total,
      done,
      remaining,
      feature_id: featureId,
      features_done: featuresDone,
      started_at: loopStartedAt,
    }));

    // 6k. Spawnar agente
    let agentResult;
    try {
      agentResult = await spawnAgent(config, featureId, sessionDir);
    } catch (err) {
      console.error(`${RED}Erro ao spawnar agente para ${featureId}: ${err.message}${NC}`);
      agentResult = { code: 1, pid: 0 };
    }

    // 6l. Registrar finished_at
    const finishedAt = now();
    await writeFile(join(sessionDir, 'finished_at'), finishedAt + '\n', 'utf8');

    // 6m. Reler features.json — verificar status
    features = await loadFeatures(featuresPath);
    const updatedFeature = features.find(f => f.id === featureId);

    if (updatedFeature && updatedFeature.status === 'passing') {
      featuresDone++;
      console.log(`${GREEN}Feature ${featureId} → passing${NC}`);
      await notifyWebhooks(config, progressPath, 'feature_done', {
        feature_id: featureId,
        feature_title: updatedFeature.title || '',
        iteration,
        features_done: featuresDone,
        features_total: total,
        exit_reason: null,
      });
    } else {
      // Gutter detection — PRP-009
      if (updatedFeature) {
        updatedFeature.retries = (updatedFeature.retries || 0) + 1;
        const retries = updatedFeature.retries;

        console.log(`${RED}Feature ${featureId} → ${updatedFeature.status || 'unknown'} (retries: ${retries}/${maxRetries * 2})${NC}`);

        // Skip: retries >= max_retries * 2
        if (retries >= maxRetries * 2) {
          updatedFeature.status = 'skipped';
          await saveFeatures(featuresPath, features);
          const skipMsg = `[${now()}] [SKIP] Feature ${featureId}: ${retries} falhas — feature pulada`;
          await appendProgress(progressPath, skipMsg);
          await writeGuardrails(guardrailsPath, featureId, retries, 'Skip após rotação de contexto', `Feature pulada após ${retries} tentativas`);
          console.log(`${RED}Feature ${featureId} → SKIPPED (${retries} falhas)${NC}`);
          await notifyWebhooks(config, progressPath, 'feature_skip', {
            feature_id: featureId,
            feature_title: updatedFeature.title || '',
            iteration,
            features_done: featuresDone,
            features_total: total,
            exit_reason: null,
          });
        }
        // Rotação de contexto: exatamente ao atingir max_retries (primeira vez)
        else if (retries === maxRetries) {
          // Rotação: registrar + rollback + marcar como failing
          updatedFeature.status = 'failing';
          await saveFeatures(featuresPath, features);

          const rotMsg = `[${now()}] [ROTAÇÃO] Feature ${featureId}: ${retries} falhas consecutivas — rotação de contexto`;
          await appendProgress(progressPath, rotMsg);

          const rollbackResult = executeRollback(rollbackMode, featureId);
          await appendProgress(progressPath, `[${now()}] ${rollbackResult}`);

          await writeGuardrails(guardrailsPath, featureId, retries, `Rotação de contexto + ${rollbackMode}`, 'Aguardando próxima tentativa com contexto limpo');
          console.log(`${YELLOW}Feature ${featureId} → ROTAÇÃO DE CONTEXTO (${retries} falhas, rollback: ${rollbackMode})${NC}`);
        }
        // Falha normal: apenas incrementar e marcar como failing
        else {
          updatedFeature.status = 'failing';
          await saveFeatures(featuresPath, features);
          const failMsg = `[${now()}] [FALHA] Feature ${featureId}: tentativa ${retries}`;
          await appendProgress(progressPath, failMsg);
        }
      }
    }

    // 6n. Atualizar state → between
    await writeState(statePath, makeState({
      status: 'between',
      iteration,
      max_iterations: maxIterations || null,
      max_features: maxFeatures || null,
      total,
      done: countByStatus(features).passing,
      remaining: total - countByStatus(features).passing,
      feature_id: featureId,
      features_done: featuresDone,
      started_at: loopStartedAt,
    }));

    // 6o. Verificar .stop após agente
    if (await fileExists(stopFile)) {
      console.log(`${YELLOW}Loop encerrado por .stop após feature ${featureId}.${NC}`);
      await notifyWebhooks(config, progressPath, 'stopped', {
        feature_id: featureId,
        feature_title: next.title || '',
        iteration,
        features_done: featuresDone,
        features_total: total,
        exit_reason: 'stopped',
      });
      await writeState(statePath, makeState({
        status: 'exited',
        iteration,
        max_iterations: maxIterations || null,
        max_features: maxFeatures || null,
        total,
        done: countByStatus(features).passing,
        remaining: total - countByStatus(features).passing,
        features_done: featuresDone,
        started_at: loopStartedAt,
        exit_reason: 'stopped',
      }));
      await unlink(stopFile).catch(() => {});
      process.exit(0);
    }

    // 6p. Aguardar entre iterações com check de .stop
    console.log(`${CYAN}Sessão ${iteration} concluída. Aguardando ${sleepBetween}s...${NC}`);
    for (let s = 0; s < sleepBetween; s++) {
      if (await fileExists(stopFile)) {
        console.log(`${YELLOW}Loop encerrado por .stop durante intervalo.${NC}`);
        await notifyWebhooks(config, progressPath, 'stopped', {
          feature_id: featureId,
          feature_title: next.title || '',
          iteration,
          features_done: featuresDone,
          features_total: total,
          exit_reason: 'stopped',
        });
        await writeState(statePath, makeState({
          status: 'exited',
          iteration,
          max_iterations: maxIterations || null,
          max_features: maxFeatures || null,
          total,
          done: countByStatus(features).passing,
          remaining: total - countByStatus(features).passing,
          features_done: featuresDone,
          started_at: loopStartedAt,
          exit_reason: 'stopped',
        }));
        await unlink(stopFile).catch(() => {});
        process.exit(0);
      }
      await sleep(1000);
    }
  }
}

// --- Entry point ---
main().catch(async err => {
  console.error(`${RED}Erro fatal no loop: ${err.message}${NC}`);
  console.error(err.stack);
  try {
    const config = JSON.parse(await readFile(resolve('agent-harness.json'), 'utf8'));
    const progressPath = config.artifacts?.progress || resolve('agent-progress.txt');
    await notifyWebhooks(config, progressPath, 'error', {
      feature_id: null,
      feature_title: null,
      iteration: 0,
      features_done: 0,
      features_total: 0,
      exit_reason: 'error',
      error_message: err.message,
    });
  } catch {
    // Se não conseguir notificar, não impede o exit
  }
  process.exit(1);
});
