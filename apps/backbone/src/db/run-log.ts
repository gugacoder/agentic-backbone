import { db } from "./index.js";

export function createRunLogQueries<TEntry>(config: {
  historyQuery: string;
  countQuery: string;
}) {
  const historyStmt = db.prepare(config.historyQuery);
  const countStmt = db.prepare(config.countQuery);

  return {
    getHistory(
      key: string,
      opts?: { limit?: number; offset?: number }
    ): { rows: TEntry[]; total: number } {
      const limit = opts?.limit ?? 50;
      const offset = opts?.offset ?? 0;
      return {
        rows: historyStmt.all(key, limit, offset) as TEntry[],
        total: (countStmt.get(key) as { total: number }).total,
      };
    },
  };
}
