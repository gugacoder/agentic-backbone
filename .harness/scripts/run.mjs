#!/usr/bin/env node
// =============================================================================
// Claude Code — Agent Runner
// Spawna o agente Claude Code para implementar uma feature.
// Exporta spawnAgent() para uso pelo loop.mjs compartilhado.
// =============================================================================

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { access } from 'node:fs/promises';

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Spawna o agente Claude Code para uma feature.
 *
 * @param {object} params
 * @param {object} params.config - config.json da session
 * @param {string} params.featureId - ID da feature (ex: F-001)
 * @param {string} params.sessionDir - path da session (.harness/{session}/)
 * @param {string} params.runsDir - path para runs (.harness/{session}/runs/)
 * @param {string} params.promptPath - path do prompt (.harness/prompt.md)
 * @param {string} params.workspace - path do workspace root
 * @param {string} params.session - nome da session
 * @returns {Promise<{code: number, pid: number}>}
 */
export async function spawnAgent({ config, featureId, sessionDir, runsDir, promptPath, workspace, session }) {
  if (!await fileExists(promptPath)) {
    throw new Error(`Prompt não encontrado: ${promptPath}`);
  }

  const maxTurns = process.env.MAX_TURNS
    ? parseInt(process.env.MAX_TURNS, 10)
    : (config.agent?.max_turns || 0);
  const model = process.env.MODEL || config.agent?.model || '';

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

  const outputPath = join(runsDir, `${featureId}.jsonl`);
  const outputStream = createWriteStream(outputPath, { flags: 'a' });

  return new Promise((resolvePromise, reject) => {
    const proc = spawn('claude', args, {
      cwd: resolve(workspace),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    // Pipe stdin do prompt (substituir placeholders pelos valores reais)
    readFile(promptPath, 'utf8').then(content => {
      let prompt = content;
      if (session) prompt = prompt.replace(/\{session\}/g, session);
      // Inject absolute runs_dir so agents can find status files regardless of CWD
      if (sessionDir) prompt = prompt.replace(/\{runs_dir\}/g, sessionDir.replace(/\\/g, '/'));
      proc.stdin.write(prompt);
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
