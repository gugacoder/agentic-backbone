#!/usr/bin/env node
// =============================================================================
// Ralph Wiggum Loop — Shared (MJS)
// Loop engine compartilhado entre harnesses. Delega spawn ao run.mjs do harness.
//
// Invocação (dentro do workspace):
//   node .harness/scripts/loop.mjs [session_name]
//
// Env overrides:
//   MAX_TURNS, MAX_ITERATIONS, MAX_FEATURES, MODEL, SLEEP_BETWEEN
//
// Graceful stop:
//   touch .stop
// =============================================================================

import { readFile, writeFile, appendFile, mkdir, access, unlink } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// --- Cores ---
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const CYAN = '\x1b[0;36m';
const NC = '\x1b[0m';

// --- Estado global para cleanup em crash ---
const loopCtx = {
  featuresPath: '',
  loopStatePath: '',
  progressPath: '',
  featureId: '',
  loopStartedAt: '',
  iteration: 0,
  featuresDone: 0,
  total: 0,
  maxIterations: null,
  maxFeatures: null,
  cleaning: false,
};

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

// --- Resolver session ---
async function resolveSession(harnessDir, explicitSession) {
  if (explicitSession) return explicitSession;
  throw new Error('Session obrigatória. Passe o nome da session como argumento: node loop.mjs <session>');
}

// --- Carregar config da session ---
async function loadSessionConfig(harnessDir, session) {
  const configPath = join(harnessDir, 'runs', session, 'config.json');
  if (!await fileExists(configPath)) {
    throw new Error(`config.json não encontrado: ${configPath}`);
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

async function writeLearnings(learningsPath, featureId, retries, action, result) {
  const ts = now();
  const entry = `\n## ${ts} — Feature ${featureId}\n\n- **Problema:** ${retries} falhas consecutivas na implementação\n- **Ação:** ${action}\n- **Resultado:** ${result}\n`;

  if (await fileExists(learningsPath)) {
    await appendFile(learningsPath, entry, 'utf8');
  } else {
    const header = '# Learnings — Lições Aprendidas\n';
    await writeFile(learningsPath, header + entry, 'utf8');
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
      name: config.project || '',
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

// --- Loop state (observabilidade) ---
function makeLoopState(overrides) {
  return {
    status: 'starting',
    pid: process.pid,
    iteration: 0,
    max_iterations: null,
    max_features: null,
    total: 0,
    done: 0,
    remaining: 0,
    feature_id: '',
    features_done: 0,
    started_at: '',
    updated_at: now(),
    exit_reason: '',
    ...overrides,
  };
}

// --- Importar runner do harness ---
async function importRunner(harnessDir, harness) {
  // Tenta importar run.mjs local (.harness/scripts/run.mjs)
  const localRunPath = join(harnessDir, 'scripts', 'run.mjs');
  if (await fileExists(localRunPath)) {
    const mod = await import(`file://${localRunPath.replace(/\\/g, '/')}`);
    return mod.spawnAgent;
  }
  throw new Error(`run.mjs não encontrado em ${localRunPath}`);
}

// --- Emergency cleanup (signal/crash) ---
async function emergencyCleanup(reason) {
  if (loopCtx.cleaning) return;
  loopCtx.cleaning = true;

  console.error(`${RED}[CLEANUP] Loop encerrado inesperadamente: ${reason}${NC}`);

  try {
    if (loopCtx.featuresPath) {
      const features = await loadFeatures(loopCtx.featuresPath);
      for (const f of features) {
        if (f.status === 'in_progress') {
          f.status = 'failing';
          f.retries = (f.retries || 0) + 1;
        }
      }
      await saveFeatures(loopCtx.featuresPath, features);
    }
  } catch { /* melhor esforço */ }

  try {
    if (loopCtx.loopStatePath) {
      await writeJson(loopCtx.loopStatePath, makeLoopState({
        status: 'exited',
        iteration: loopCtx.iteration,
        max_iterations: loopCtx.maxIterations,
        max_features: loopCtx.maxFeatures,
        total: loopCtx.total,
        done: 0,
        remaining: loopCtx.total,
        feature_id: loopCtx.featureId,
        features_done: loopCtx.featuresDone,
        started_at: loopCtx.loopStartedAt,
        exit_reason: reason,
      }));
    }
  } catch { /* melhor esforço */ }

  try {
    if (loopCtx.progressPath) {
      const msg = `[${now()}] [CRASH] Loop encerrado: ${reason}` +
        (loopCtx.featureId ? ` (feature: ${loopCtx.featureId})` : '');
      await appendProgress(loopCtx.progressPath, msg);
    }
  } catch { /* melhor esforço */ }
}

// Registrar signal handlers
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, async () => {
    await emergencyCleanup(`signal_${sig}`);
    process.exit(1);
  });
}

process.on('uncaughtException', async (err) => {
  await emergencyCleanup(`uncaughtException: ${err.message}`);
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  await emergencyCleanup(`unhandledRejection: ${reason}`);
  process.exit(1);
});

// --- Main ---
async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const rootWorkspace = resolve('.');
  const harnessDir = join(rootWorkspace, '.harness');

  // Resolver session
  const explicitSession = process.argv[2] || '';
  const session = await resolveSession(harnessDir, explicitSession);
  const sessionDir = join(harnessDir, 'runs', session);

  // Carregar config
  const config = await loadSessionConfig(harnessDir, session);
  const harness = config.agent?.harness || 'claude-code';

  // Agent workspace = worktree (from config) or root (fallback for non-worktree runs)
  const agentWorkspace = config.worktree || rootWorkspace;

  // Paths — status files in ROOT, agent runs in worktree
  const featuresPath = join(sessionDir, 'features.json');
  const loopStatePath = join(sessionDir, 'loop.json');
  const progressPath = join(sessionDir, 'progress.txt');
  const runsDir = join(sessionDir, 'runs');
  const learningsPath = join(harnessDir, 'learnings.md');
  const promptPath = join(harnessDir, 'prompt.md');
  const stopFile = join(sessionDir, '.stop');

  // Resiliência
  const maxRetries = config.agent?.max_retries || 5;
  const rollbackMode = config.agent?.rollback || 'stash';

  // Env overrides
  const maxIterations = process.env.MAX_ITERATIONS
    ? parseInt(process.env.MAX_ITERATIONS, 10)
    : (config.agent?.max_iterations || 0);
  const maxFeatures = process.env.MAX_FEATURES
    ? parseInt(process.env.MAX_FEATURES, 10)
    : (config.agent?.max_features || 0);
  const sleepBetween = parseInt(process.env.SLEEP_BETWEEN || '5', 10);

  // Importar runner — try worktree first, then root
  const worktreeHarnessDir = join(agentWorkspace, '.harness');
  let spawnAgent;
  try {
    spawnAgent = await importRunner(worktreeHarnessDir, harness);
  } catch {
    spawnAgent = await importRunner(harnessDir, harness);
  }

  // Verificar features.json
  if (!await fileExists(featuresPath)) {
    console.error(`${RED}features.json não encontrado: ${featuresPath}${NC}`);
    process.exit(1);
  }

  // Garantir diretório runs
  await mkdir(runsDir, { recursive: true });

  // .stop residual
  if (await fileExists(stopFile)) {
    console.log(`${YELLOW}AVISO: .stop residual encontrado. Removendo para iniciar.${NC}`);
    await unlink(stopFile);
  }

  // Populate loopCtx para cleanup em crash
  loopCtx.featuresPath = featuresPath;
  loopCtx.loopStatePath = loopStatePath;
  loopCtx.progressPath = progressPath;
  loopCtx.maxIterations = maxIterations || null;
  loopCtx.maxFeatures = maxFeatures || null;

  // Estado inicial
  const loopStartedAt = now();
  loopCtx.loopStartedAt = loopStartedAt;
  let features = await loadFeatures(featuresPath);
  const total = features.length;
  loopCtx.total = total;
  const counts = countByStatus(features);

  const limitLabel = maxIterations === 0 ? '∞' : String(maxIterations);
  const featuresLimitLabel = maxFeatures === 0 ? '∞' : String(maxFeatures);

  console.log(`${CYAN}=======================================${NC}`);
  console.log(`${CYAN}  Ralph Wiggum Loop${NC}`);
  console.log(`${CYAN}  Session: ${session}${NC}`);
  console.log(`${CYAN}  Harness: ${harness}${NC}`);
  console.log(`${CYAN}  Iterações: ${limitLabel}${NC}`);
  console.log(`${CYAN}  Max features: ${featuresLimitLabel}${NC}`);
  console.log(`${CYAN}  Para parar: touch .stop${NC}`);
  console.log(`${CYAN}=======================================${NC}`);
  console.log('');

  await writeJson(loopStatePath, makeLoopState({
    status: 'starting',
    max_iterations: maxIterations || null,
    max_features: maxFeatures || null,
    total,
    done: counts.passing,
    remaining: total - counts.passing,
    started_at: loopStartedAt,
  }));

  // Loop principal
  let iteration = 0;
  let featuresDone = 0;

  while (true) {
    iteration++;

    // Limite de iterações
    if (maxIterations > 0 && iteration > maxIterations) {
      console.log(`${RED}Limite de ${maxIterations} iterações atingido.${NC}`);
      await writeJson(loopStatePath, makeLoopState({
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

    // Limite de features
    if (maxFeatures > 0 && featuresDone >= maxFeatures) {
      console.log(`${GREEN}Limite de ${maxFeatures} feature(s) completada(s) atingido.${NC}`);
      await writeJson(loopStatePath, makeLoopState({
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

    // Graceful stop check
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
      await writeJson(loopStatePath, makeLoopState({
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

    // Recarregar features
    features = await loadFeatures(featuresPath);
    computeBlocked(features);

    // Selecionar próxima feature
    const next = selectNextFeature(features);

    if (!next) {
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
        await writeJson(loopStatePath, makeLoopState({
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
      await writeJson(loopStatePath, makeLoopState({
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
    loopCtx.featureId = featureId;
    loopCtx.iteration = iteration;
    const currentCounts = countByStatus(features);
    const done = currentCounts.passing;
    const remaining = total - done;

    console.log(`${YELLOW}--- Iteração ${iteration}/${limitLabel} | ${featureId} | Features: ${done}/${total} (faltam ${remaining}) ---${NC}`);

    // Marcar feature como in_progress
    next.status = 'in_progress';
    await saveFeatures(featuresPath, features);

    // Criar metadata da feature run (escrita ANTES do spawn para visibilidade no dashboard)
    const startedAt = now();
    const runMetaPath = join(runsDir, `${featureId}.json`);
    const runMeta = {
      feature_id: featureId,
      started_at: startedAt,
      finished_at: null,
      agent_pid: null,
      exit_code: null,
      retries: next.retries || 0,
    };
    await writeJson(runMetaPath, runMeta);

    // Atualizar loop state → running
    await writeJson(loopStatePath, makeLoopState({
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

    // Spawnar agente via runner do harness
    let agentResult;
    try {
      agentResult = await spawnAgent({
        config,
        featureId,
        sessionDir,
        runsDir,
        promptPath,
        workspace: agentWorkspace,
        session,
      });
    } catch (err) {
      console.error(`${RED}Erro ao spawnar agente para ${featureId}: ${err.message}${NC}`);
      agentResult = { code: 1, pid: 0 };
    }

    // Atualizar metadata da feature run (com dados finais)
    runMeta.finished_at = now();
    runMeta.agent_pid = agentResult.pid || null;
    runMeta.exit_code = agentResult.code ?? null;
    await writeJson(runMetaPath, runMeta);

    // Reler features.json — verificar status
    features = await loadFeatures(featuresPath);
    const updatedFeature = features.find(f => f.id === featureId);

    if (updatedFeature && updatedFeature.status === 'passing') {
      featuresDone++;
      loopCtx.featuresDone = featuresDone;
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
      // Gutter detection
      if (updatedFeature) {
        updatedFeature.retries = (updatedFeature.retries || 0) + 1;
        const retries = updatedFeature.retries;

        console.log(`${RED}Feature ${featureId} → ${updatedFeature.status || 'unknown'} (retries: ${retries}/${maxRetries * 2})${NC}`);

        if (retries >= maxRetries * 2) {
          updatedFeature.status = 'skipped';
          await saveFeatures(featuresPath, features);
          const skipMsg = `[${now()}] [SKIP] Feature ${featureId}: ${retries} falhas — feature pulada`;
          await appendProgress(progressPath, skipMsg);
          await writeLearnings(learningsPath, featureId, retries, 'Skip após rotação de contexto', `Feature pulada após ${retries} tentativas`);
          console.log(`${RED}Feature ${featureId} → SKIPPED (${retries} falhas)${NC}`);
          await notifyWebhooks(config, progressPath, 'feature_skip', {
            feature_id: featureId,
            feature_title: updatedFeature.title || '',
            iteration,
            features_done: featuresDone,
            features_total: total,
            exit_reason: null,
          });
        } else if (retries === maxRetries) {
          updatedFeature.status = 'failing';
          await saveFeatures(featuresPath, features);

          const rotMsg = `[${now()}] [ROTAÇÃO] Feature ${featureId}: ${retries} falhas consecutivas — rotação de contexto`;
          await appendProgress(progressPath, rotMsg);

          const rollbackResult = executeRollback(rollbackMode, featureId);
          await appendProgress(progressPath, `[${now()}] ${rollbackResult}`);

          await writeLearnings(learningsPath, featureId, retries, `Rotação de contexto + ${rollbackMode}`, 'Aguardando próxima tentativa com contexto limpo');
          console.log(`${YELLOW}Feature ${featureId} → ROTAÇÃO DE CONTEXTO (${retries} falhas, rollback: ${rollbackMode})${NC}`);
        } else {
          updatedFeature.status = 'failing';
          await saveFeatures(featuresPath, features);
          const failMsg = `[${now()}] [FALHA] Feature ${featureId}: tentativa ${retries}`;
          await appendProgress(progressPath, failMsg);
        }
      }
    }

    // Limpar featureId do ctx (feature processada)
    loopCtx.featureId = '';

    // Atualizar loop state → between
    await writeJson(loopStatePath, makeLoopState({
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

    // Verificar .stop após agente
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
      await writeJson(loopStatePath, makeLoopState({
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

    // Aguardar entre iterações
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
        await writeJson(loopStatePath, makeLoopState({
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
    const harnessDir = join(resolve('.'), '.harness');
    const session = process.argv[2] || '';
    if (session) {
      const config = JSON.parse(await readFile(join(harnessDir, 'runs', session, 'config.json'), 'utf8'));
      const progressPath = join(harnessDir, 'runs', session, 'progress.txt');
      await notifyWebhooks(config, progressPath, 'error', {
        feature_id: null,
        feature_title: null,
        iteration: 0,
        features_done: 0,
        features_total: 0,
        exit_reason: 'error',
        error_message: err.message,
      });
    }
  } catch {
    // Se não conseguir notificar, não impede o exit
  }
  process.exit(1);
});
