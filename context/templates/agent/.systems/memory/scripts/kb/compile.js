// Compile daily conversation logs into structured knowledge articles.
//
// Usage:
//   node compile.js                    # compile new/changed logs only
//   node compile.js --all              # force recompile everything
//   node compile.js --file calendar/notes/2026-04-01.md
//   node compile.js --dry-run          # show what would be compiled

import fs from "node:fs";
import path from "node:path";

import {
  AGENT_ROOT,
  CONCEPTS_DIR,
  CONNECTIONS_DIR,
  HOME_FILE,
  LOG_FILE,
  NOTES_DIR,
  PROMPTS_DIR,
  nowIso,
} from "./config.js";
import {
  fileHash,
  listRawFiles,
  listWikiArticles,
  loadPrompt,
  loadState,
  readExistingArticlesContext,
  readWikiIndex,
  saveState,
} from "./utils.js";

function parseArgs(argv) {
  const out = { all: false, file: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") out.all = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--file") out.file = argv[++i];
  }
  return out;
}

async function compileDailyLog(logPath, state, logHashValue) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const logContent = fs.readFileSync(logPath, "utf-8");
  const schema = fs.readFileSync(path.join(PROMPTS_DIR, "schema.md"), "utf-8");
  const timestamp = nowIso();

  const prompt = loadPrompt("compile.md", {
    schema,
    wiki_index: readWikiIndex(),
    existing_articles_context: readExistingArticlesContext(),
    log_filename: path.basename(logPath),
    log_content: logContent,
    timestamp,
    timestamp_date: timestamp.slice(0, 10),
    concepts_dir: CONCEPTS_DIR,
    connections_dir: CONNECTIONS_DIR,
    home_file: HOME_FILE,
    calendar_log: LOG_FILE,
  });

  let cost = 0.0;
  let succeeded = false;

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: AGENT_ROOT,
        systemPrompt: { type: "preset", preset: "claude_code" },
        allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
        permissionMode: "acceptEdits",
        maxTurns: 30,
      },
    })) {
      if (message.type === "result") {
        cost = message.total_cost_usd || 0.0;
        succeeded = true;
        console.log(`  Cost: $${cost.toFixed(4)}`);
      }
    }
  } catch (e) {
    console.log(`  Error: ${e?.message || e}`);
    return 0.0;
  }

  if (!succeeded) {
    console.log("  Warning: compile ended without a result message; not recording state");
    return 0.0;
  }

  state.ingested ||= {};
  state.ingested[path.basename(logPath)] = {
    hash: logHashValue,
    compiled_at: nowIso(),
    cost_usd: cost,
  };
  state.total_cost = (state.total_cost || 0.0) + cost;
  saveState(state);

  return cost;
}

async function main() {
  const args = parseArgs(process.argv);
  const state = loadState();
  const ingested = state.ingested || {};

  let toCompile = [];
  if (args.file) {
    let target = args.file;
    if (!path.isAbsolute(target)) target = path.join(NOTES_DIR, path.basename(target));
    if (!fs.existsSync(target)) target = path.join(AGENT_ROOT, args.file);
    if (!fs.existsSync(target)) {
      console.log(`Error: ${args.file} not found`);
      process.exit(1);
    }
    toCompile = [[target, fileHash(target)]];
  } else {
    const allLogs = listRawFiles();
    if (args.all) {
      toCompile = allLogs.map((p) => [p, fileHash(p)]);
    } else {
      for (const logPath of allLogs) {
        const h = fileHash(logPath);
        const prev = ingested[path.basename(logPath)] || {};
        if (prev.hash !== h) toCompile.push([logPath, h]);
      }
    }
  }

  if (toCompile.length === 0) {
    console.log("Nothing to compile - all daily logs are up to date.");
    return;
  }

  console.log(`${args.dryRun ? "[DRY RUN] " : ""}Files to compile (${toCompile.length}):`);
  for (const [p] of toCompile) console.log(`  - ${path.basename(p)}`);

  if (args.dryRun) return;

  let totalCost = 0.0;
  for (let i = 0; i < toCompile.length; i++) {
    const [logPath, h] = toCompile[i];
    console.log(`\n[${i + 1}/${toCompile.length}] Compiling ${path.basename(logPath)}...`);
    const cost = await compileDailyLog(logPath, state, h);
    totalCost += cost;
    console.log(`  Done.`);
  }

  const articles = listWikiArticles();
  console.log(`\nCompilation complete. Total cost: $${totalCost.toFixed(2)}`);
  console.log(`Knowledge base: ${articles.length} articles`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
