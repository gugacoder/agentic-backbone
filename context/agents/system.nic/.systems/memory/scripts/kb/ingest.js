// Ingest external files from the inbox kb/+/ into the knowledge base.
//
// Usage:
//   node ingest.js                    # process all new inbox files
//   node ingest.js --all              # reprocess every inbox file, ignoring hashes
//   node ingest.js --file <path>      # process a specific file
//   node ingest.js --dry-run          # list what would be processed

import fs from "node:fs";
import path from "node:path";

import {
  AGENT_ROOT,
  CONCEPTS_DIR,
  CONNECTIONS_DIR,
  HOME_FILE,
  INBOX_DIR,
  LOG_FILE,
  PROMPTS_DIR,
  X_FILES_DIR,
  nowIso,
} from "./config.js";
import {
  fileHash,
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

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(full);
    }
  }
  return out.sort();
}

function listInboxFiles() {
  return walkFiles(INBOX_DIR);
}

function relFromInbox(p) {
  const rel = path.relative(INBOX_DIR, p);
  if (rel.startsWith("..")) return path.basename(p);
  return rel.replace(/\\/g, "/");
}

async function ingestFile(filePath, state, fileHashValue) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const schema = fs.readFileSync(path.join(PROMPTS_DIR, "schema.md"), "utf-8");
  const timestamp = nowIso();

  const prompt = loadPrompt("ingest.md", {
    schema,
    wiki_index: readWikiIndex(),
    existing_articles_context: readExistingArticlesContext(),
    file_path: filePath,
    file_name: path.basename(filePath),
    files_dir: X_FILES_DIR,
    concepts_dir: CONCEPTS_DIR,
    connections_dir: CONNECTIONS_DIR,
    home_file: HOME_FILE,
    calendar_log: LOG_FILE,
    timestamp,
    timestamp_date: timestamp.slice(0, 10),
  });

  fs.mkdirSync(X_FILES_DIR, { recursive: true });

  let cost = 0.0;
  let succeeded = false;

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: AGENT_ROOT,
        systemPrompt: { type: "preset", preset: "claude_code" },
        allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
        permissionMode: "bypassPermissions",
        maxTurns: 40,
      },
    })) {
      if (message.type === "result") {
        cost = message.total_cost_usd || 0.0;
        succeeded = true;
        console.log(`  Cost: $${cost.toFixed(4)}`);
      }
    }
  } catch (e) {
    console.log(`  Error ingesting ${path.basename(filePath)}: ${e?.message || e}`);
    return 0.0;
  }

  if (!succeeded) {
    console.log("  Warning: ingest ended without a result message; not recording state");
    return 0.0;
  }

  state.ingested_files ||= {};
  state.ingested_files[relFromInbox(filePath)] = {
    hash: fileHashValue,
    ingested_at: nowIso(),
    cost_usd: cost,
  };
  state.total_cost = (state.total_cost || 0.0) + cost;
  saveState(state);

  return cost;
}

async function main() {
  const args = parseArgs(process.argv);
  const state = loadState();
  const ingested = state.ingested_files || {};

  let toIngest = [];
  if (args.file) {
    let target = args.file;
    if (!path.isAbsolute(target)) target = path.join(INBOX_DIR, target);
    if (!fs.existsSync(target)) {
      console.log(`Error: ${args.file} not found`);
      process.exit(1);
    }
    toIngest = [[target, fileHash(target)]];
  } else {
    const allInbox = listInboxFiles();
    if (args.all) {
      toIngest = allInbox.map((p) => [p, fileHash(p)]);
    } else {
      for (const p of allInbox) {
        const h = fileHash(p);
        const prev = ingested[relFromInbox(p)] || {};
        if (prev.hash !== h) toIngest.push([p, h]);
      }
    }
  }

  if (toIngest.length === 0) {
    console.log("Inbox is empty or all files are already ingested.");
    return;
  }

  console.log(`${args.dryRun ? "[DRY RUN] " : ""}Files to ingest (${toIngest.length}):`);
  for (const [p] of toIngest) console.log(`  - ${relFromInbox(p)}`);

  if (args.dryRun) return;

  let totalCost = 0.0;
  for (let i = 0; i < toIngest.length; i++) {
    const [p, h] = toIngest[i];
    console.log(`\n[${i + 1}/${toIngest.length}] Ingesting ${path.basename(p)}...`);
    const cost = await ingestFile(p, state, h);
    totalCost += cost;
    console.log(`  Done.`);
  }

  console.log(`\nIngestion complete. Total cost: $${totalCost.toFixed(2)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
