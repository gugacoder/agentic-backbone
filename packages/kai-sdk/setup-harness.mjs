#!/usr/bin/env node
// =============================================================================
// Setup Harness — Claude Code
// Script autocontido que roda no workspace destino.
// Invoca o initializer agent para gerar features.json.
//
// Invocação:
//   cd /path/to/workspace
//   node setup-harness.mjs [--force]
//
// --force: re-gera features.json mesmo se já existir.
//          Arquiva .sessions/ existente para .sessions/.history/{guid}
// =============================================================================

import { spawn } from 'node:child_process';
import { readFile, access, mkdir, readdir, rename, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';

// --- Cores ---
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const CYAN = '\x1b[0;36m';
const NC = '\x1b[0m';

// --- Utilitários ---
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

// --- Main ---
async function main() {
  const { values } = parseArgs({
    options: {
      force: { type: 'boolean', default: false },
    },
    strict: true,
  });

  console.log(`${CYAN}=======================================${NC}`);
  console.log(`${CYAN}  Setup Harness — Claude Code${NC}`);
  console.log(`${CYAN}=======================================${NC}`);
  console.log('');

  // 1. Verificar agent-harness.json
  const configPath = resolve('agent-harness.json');
  if (!await fileExists(configPath)) {
    console.error(`${RED}agent-harness.json não encontrado no diretório corrente.${NC}`);
    process.exit(1);
  }

  const config = await readJson(configPath);
  console.log(`${CYAN}Projeto: ${config.name || config.slug}${NC}`);

  // 2. Verificar se features.json já existe
  const featuresPath = config.artifacts?.features || resolve('features.json');
  if (await fileExists(featuresPath)) {
    try {
      const features = await readJson(featuresPath);
      const featuresList = Array.isArray(features) ? features : (features.features ?? []);
      if (featuresList.length > 0 && !values.force) {
        console.error(`${RED}features.json já existe com ${featuresList.length} features.${NC}`);
        console.error(`${RED}Use --force para re-gerar.${NC}`);
        process.exit(1);
      }
    } catch {
      // features.json inválido — pode continuar
    }
  }

  // 3. Arquivar .sessions se --force
  const sessionsDir = config.artifacts?.sessions || resolve('.sessions');
  if (values.force && await fileExists(sessionsDir)) {
    const historyDir = join(sessionsDir, '.history');
    await mkdir(historyDir, { recursive: true });

    const guid = randomBytes(4).toString('hex');
    const archiveDir = join(historyDir, guid);
    await mkdir(archiveDir, { recursive: true });

    // Mover conteúdo de .sessions/* (exceto .history) para .sessions/.history/{guid}/
    try {
      const entries = await readdir(sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.history') continue;
        const srcPath = join(sessionsDir, entry.name);
        const destPath = join(archiveDir, entry.name);
        await rename(srcPath, destPath);
      }
      console.log(`${YELLOW}Sessões arquivadas em .sessions/.history/${guid}${NC}`);
    } catch (err) {
      console.log(`${YELLOW}Aviso: não foi possível arquivar sessões: ${err.message}${NC}`);
    }
  }

  // 4. Limpar features.json e progress se --force
  if (values.force) {
    const progressPath = config.artifacts?.progress || resolve('agent-progress.txt');
    try {
      await writeFile(featuresPath, '[]', 'utf8');
      await writeFile(progressPath, '', 'utf8');
      console.log(`${YELLOW}features.json e progress resetados.${NC}`);
    } catch {
      // ok
    }
  }

  // 5. Spawnar initializer agent
  const commandPath = resolve('.claude', 'commands', 'vibe', 'initialize.md');
  if (!await fileExists(commandPath)) {
    console.error(`${RED}initialize.md não encontrado em .claude/commands/vibe/${NC}`);
    console.error(`${RED}Execute init-workspace primeiro para copiar os templates.${NC}`);
    process.exit(1);
  }

  console.log(`${CYAN}Spawnando initializer agent...${NC}`);
  console.log('');

  const initPrompt = await readFile(commandPath, 'utf8');

  const args = [
    '-p', '-',
    '--allowedTools', 'Edit,Write,Bash,Read,Glob,Grep',
  ];

  const model = process.env.MODEL || config.agent?.model || '';
  if (model) {
    args.push('--model', model);
  }

  const proc = spawn('claude', args, {
    cwd: resolve('.'),
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true,
  });

  proc.stdin.write(initPrompt);
  proc.stdin.end();

  const exitCode = await new Promise((resolvePromise, reject) => {
    proc.on('close', (code) => resolvePromise(code));
    proc.on('error', (err) => reject(err));
  });

  if (exitCode === 0) {
    console.log('');
    console.log(`${GREEN}=======================================${NC}`);
    console.log(`${GREEN}  Setup concluído com sucesso!${NC}`);
    console.log(`${GREEN}=======================================${NC}`);
  } else {
    console.log('');
    console.error(`${RED}Setup falhou com código ${exitCode}.${NC}`);
    process.exit(exitCode);
  }
}

// --- Entry point ---
main().catch(err => {
  console.error(`${RED}Erro fatal no setup: ${err.message}${NC}`);
  console.error(err.stack);
  process.exit(1);
});
