import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import {
  ATLAS_DIR,
  CONCEPTS_DIR,
  CONNECTIONS_DIR,
  EFFORT_DIR,
  HOME_FILE,
  MAPS_DIR,
  NOTES_DIR,
  PROMPTS_DIR,
  QA_DIR,
  STATE_FILE,
  WORKS_DIR,
} from "./config.js";

// ── State management ──────────────────────────────────────────────────

export function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  }
  return { ingested: {}, query_count: 0, last_lint: null, total_cost: 0.0 };
}

export function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// ── File hashing ──────────────────────────────────────────────────────

export function fileHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

// ── Slug / naming ─────────────────────────────────────────────────────

export function slugify(text) {
  let t = text.toLowerCase().trim();
  t = t.replace(/[^\w\s-]/g, "");
  t = t.replace(/[\s_]+/g, "-");
  t = t.replace(/-+/g, "-");
  return t.replace(/^-+|-+$/g, "");
}

// ── Wikilink helpers ──────────────────────────────────────────────────

export function extractWikilinks(content) {
  const re = /\[\[([^\]]+)\]\]/g;
  const out = [];
  let m;
  while ((m = re.exec(content)) !== null) out.push(m[1]);
  return out;
}

export function wikiArticleExists(link) {
  for (const parent of [ATLAS_DIR, EFFORT_DIR]) {
    if (fs.existsSync(path.join(parent, `${link}.md`))) return true;
  }
  return false;
}

export function resolveWikiPath(link) {
  for (const parent of [ATLAS_DIR, EFFORT_DIR]) {
    const candidate = path.join(parent, `${link}.md`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// ── Wiki content helpers ──────────────────────────────────────────────

export function readWikiIndex() {
  if (fs.existsSync(HOME_FILE)) {
    return fs.readFileSync(HOME_FILE, "utf-8");
  }
  return "# Knowledge Base Index\n\n| Article | Summary | Compiled From | Updated |\n|---------|---------|---------------|---------|";
}

function listMdSorted(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => path.join(dir, f));
}

export function readAllWikiContent() {
  const parts = [`## INDEX\n\n${readWikiIndex()}`];
  for (const subdir of [CONCEPTS_DIR, CONNECTIONS_DIR, MAPS_DIR, QA_DIR, WORKS_DIR]) {
    for (const mdFile of listMdSorted(subdir)) {
      const rel = path.relative(ATLAS_DIR, mdFile).replace(/\\/g, "/");
      const content = fs.readFileSync(mdFile, "utf-8");
      parts.push(`## ${rel}\n\n${content}`);
    }
  }
  return parts.join("\n\n---\n\n");
}

export function listWikiArticles() {
  const articles = [];
  for (const subdir of [CONCEPTS_DIR, CONNECTIONS_DIR, MAPS_DIR, QA_DIR, WORKS_DIR]) {
    articles.push(...listMdSorted(subdir));
  }
  return articles;
}

export function readExistingArticlesContext() {
  const sections = [];
  for (const articlePath of listWikiArticles()) {
    const rel = path.relative(ATLAS_DIR, articlePath).replace(/\\/g, "/");
    const content = fs.readFileSync(articlePath, "utf-8");
    sections.push(`### ${rel}\n\`\`\`markdown\n${content}\n\`\`\``);
  }
  if (sections.length === 0) return "(No existing articles yet)";
  return sections.join("\n\n");
}

export function listRawFiles() {
  if (!fs.existsSync(NOTES_DIR)) return [];
  return fs
    .readdirSync(NOTES_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => path.join(NOTES_DIR, f));
}

// ── Index helpers ─────────────────────────────────────────────────────

export function countInboundLinks(target, excludeFile = null) {
  let count = 0;
  for (const article of listWikiArticles()) {
    if (excludeFile && article === excludeFile) continue;
    const content = fs.readFileSync(article, "utf-8");
    if (content.includes(`[[${target}]]`)) count += 1;
  }
  return count;
}

export function getArticleWordCount(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  if (content.startsWith("---")) {
    const end = content.indexOf("---", 3);
    if (end !== -1) content = content.slice(end + 3);
  }
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function buildIndexEntry(relPath, summary, sources, updated) {
  const link = relPath.replace(/\.md$/, "");
  return `| [[${link}]] | ${summary} | ${sources} | ${updated} |`;
}

// ── Prompt loading ────────────────────────────────────────────────────

export function loadPrompt(name, vars = {}) {
  const filePath = path.join(PROMPTS_DIR, name);
  let text = fs.readFileSync(filePath, "utf-8");
  for (const [key, value] of Object.entries(vars)) {
    text = text.split(`{${key}}`).join(String(value));
  }
  return text;
}
