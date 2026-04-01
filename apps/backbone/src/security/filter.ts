import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { db } from "../db/index.js";
import { settingsPath } from "../context/paths.js";
import { readYaml } from "../context/readers.js";

// --- Types ---

export type SecurityAction = "blocked" | "flagged" | "allow";

export interface SecurityCheckResult {
  action: SecurityAction;
  patternMatched?: string;
  score?: number;
  severity?: string;
}

interface SecurityRule {
  id: number;
  name: string;
  pattern: string;
  rule_type: "keyword" | "regex";
  severity: string;
  action: "blocked" | "flagged";
  enabled: number;
}

// --- Prepared statements ---

const selectRules = db.prepare(
  `SELECT id, name, pattern, rule_type, severity, action, enabled
   FROM security_rules WHERE enabled = 1`
);

const insertEvent = db.prepare(
  `INSERT INTO security_events (agent_id, session_id, event_type, severity, action, input_hash, input_excerpt, pattern_matched, score)
   VALUES (?, ?, 'message_filter', ?, ?, ?, ?, ?, ?)`
);

// --- Core function ---

export async function checkMessageSecurity(
  input: string,
  agentId: string,
  sessionId: string
): Promise<SecurityCheckResult> {
  // Check if security filter is disabled via settings.yml
  if (existsSync(settingsPath())) {
    const settings = readYaml(settingsPath()) as Record<string, unknown>;
    const security = settings.security as Record<string, unknown> | undefined;
    if (security?.["message-filter"] === false) {
      return { action: "allow" };
    }
  }

  const normalized = input.toLowerCase().trim();

  const rules = selectRules.all() as SecurityRule[];

  let highestAction: SecurityAction = "allow";
  let matchedRule: SecurityRule | null = null;
  let matchScore = 0;

  for (const rule of rules) {
    let matched = false;
    let score = 0;

    if (rule.rule_type === "keyword") {
      let keywords: string[];
      try {
        keywords = JSON.parse(rule.pattern) as string[];
      } catch {
        continue;
      }
      for (const kw of keywords) {
        if (normalized.includes(kw.toLowerCase())) {
          matched = true;
          score = 1.0;
          break;
        }
      }
    } else if (rule.rule_type === "regex") {
      try {
        const re = new RegExp(rule.pattern, "i");
        if (re.test(normalized)) {
          matched = true;
          score = 0.9;
        }
      } catch {
        continue;
      }
    }

    if (!matched) continue;

    // blocked > flagged
    if (rule.action === "blocked") {
      highestAction = "blocked";
      matchedRule = rule;
      matchScore = score;
      break; // can't get worse
    } else if (rule.action === "flagged" && highestAction === "allow") {
      highestAction = "flagged";
      matchedRule = rule;
      matchScore = score;
    }
  }

  if (matchedRule && highestAction !== "allow") {
    const inputHash = createHash("sha256").update(input).digest("hex");
    const inputExcerpt = input.slice(0, 200);

    insertEvent.run(
      agentId,
      sessionId,
      matchedRule.severity,
      highestAction,
      inputHash,
      inputExcerpt,
      matchedRule.name,
      matchScore
    );

    return {
      action: highestAction,
      patternMatched: matchedRule.name,
      score: matchScore,
      severity: matchedRule.severity,
    };
  }

  return { action: "allow" };
}
