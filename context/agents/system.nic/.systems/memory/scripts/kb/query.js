// Query the knowledge base using index-guided retrieval (no RAG).
//
// Usage:
//   node query.js "How should I handle auth redirects?"
//   node query.js "What patterns do I use for API design?" --file-back

import fs from "node:fs";
import path from "node:path";

import { AGENT_ROOT, HOME_FILE, LOG_FILE, QA_DIR, nowIso } from "./config.js";
import { loadPrompt, loadState, readAllWikiContent, saveState } from "./utils.js";

function parseArgs(argv) {
  const out = { question: null, fileBack: false };
  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file-back") out.fileBack = true;
    else rest.push(a);
  }
  out.question = rest.join(" ");
  return out;
}

async function runQuery(question, fileBack = false) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const wikiContent = readAllWikiContent();

  const tools = ["Read", "Glob", "Grep"];
  if (fileBack) tools.push("Write", "Edit");

  let fileBackInstructions = "";
  if (fileBack) {
    const timestamp = nowIso();
    fileBackInstructions = loadPrompt("query-file-back.md", {
      qa_dir: QA_DIR,
      home_file: HOME_FILE,
      calendar_log: LOG_FILE,
      timestamp,
      question,
    });
  }

  const prompt = loadPrompt("query.md", {
    wiki_content: wikiContent,
    question,
    file_back_instructions: fileBackInstructions,
  });

  let answer = "";
  let cost = 0.0;

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: AGENT_ROOT,
        systemPrompt: { type: "preset", preset: "claude_code" },
        allowedTools: tools,
        permissionMode: "acceptEdits",
        maxTurns: 15,
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message?.content || []) {
          if (block.type === "text") answer += block.text;
        }
      } else if (message.type === "result") {
        cost = message.total_cost_usd || 0.0;
      }
    }
  } catch (e) {
    answer = `Error querying knowledge base: ${e?.message || e}`;
  }

  const state = loadState();
  state.query_count = (state.query_count || 0) + 1;
  state.total_cost = (state.total_cost || 0.0) + cost;
  saveState(state);

  return answer;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.question) {
    console.log('Usage: node query.js "<question>" [--file-back]');
    process.exit(1);
  }

  console.log(`Question: ${args.question}`);
  console.log(`File back: ${args.fileBack ? "yes" : "no"}`);
  console.log("-".repeat(60));

  const answer = await runQuery(args.question, args.fileBack);
  console.log(answer);

  if (args.fileBack) {
    console.log("\n" + "-".repeat(60));
    const qaCount = fs.existsSync(QA_DIR)
      ? fs.readdirSync(QA_DIR).filter((f) => f.endsWith(".md")).length
      : 0;
    console.log(`Answer filed to atlas/qa/ (${qaCount} Q&A articles total)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
