export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string };

export type CronPayload =
  | { kind: "heartbeat" }
  | { kind: "agentTurn"; message: string };

export interface CronJobState {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
  consecutiveErrors?: number;
  scheduleErrorCount?: number;
}

export interface CronJobDef {
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
  deleteAfterRun?: boolean;
  description?: string;
}

export interface CronJob {
  /** slug do arquivo (sem .md) */
  slug: string;
  /** agentId do owner */
  agentId: string;
  /** caminho do .md */
  path: string;
  /** definição parseada do frontmatter */
  def: CronJobDef;
  /** estado runtime */
  state: CronJobState;
}

export type CronJobCreate = {
  slug: string;
  agentId: string;
  def: CronJobDef;
};

export type CronJobPatch = Partial<CronJobDef>;
