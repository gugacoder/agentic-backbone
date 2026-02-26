#!/usr/bin/env node
// =============================================================================
// Claude Code — Initializer Runner
// Spawna o agente inicializador que gera features.json a partir dos PRPs.
// =============================================================================

import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
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
 * Spawna o agente inicializador Claude Code.
 *
 * @param {object} params
 * @param {string} params.workspace - path do workspace root
 * @param {string} params.initPromptPath - path do prompt de inicialização
 * @returns {Promise<{code: number, pid: number}>}
 */
export async function spawnInitializer({ workspace, initPromptPath }) {
  if (!await fileExists(initPromptPath)) {
    throw new Error(`Prompt de inicialização não encontrado: ${initPromptPath}`);
  }

  const args = [
    '-p', '-',
    '--verbose',
    '--allowedTools', 'Edit,Write,Bash,Read,Glob,Grep',
  ];

  return new Promise((resolvePromise, reject) => {
    const proc = spawn('claude', args, {
      cwd: resolve(workspace),
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: true,
    });

    readFile(initPromptPath, 'utf8').then(content => {
      proc.stdin.write(content);
      proc.stdin.end();
    }).catch(err => {
      proc.kill();
      reject(err);
    });

    proc.on('close', (code) => {
      resolvePromise({ code, pid: proc.pid });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}
