import type { ZodType } from "zod";

// ---------------------------------------------------------------------------
// Drop-in tool interfaces — motor for agentic-context tools
// ---------------------------------------------------------------------------

/**
 * Contrato que todo tool.ts deve satisfazer.
 * name e description vem do TOOL.md frontmatter — nao ficam aqui.
 */
export interface DropInToolModule {
  parameters: ZodType<any>;
  execute: (args: any, ctx: DropInToolContext) => Promise<any>;
}

/**
 * Contexto injetado pelo loader em cada chamada de execute.
 */
export interface DropInToolContext {
  adapter: (slug: string) => Promise<AdapterHandle>;
}

/**
 * Interface minima de adapter — evita acoplar tool.ts ao backbone.
 * Identica em runtime a AdapterInstance do loader.
 */
export interface AdapterHandle {
  query: (sql: string, params?: any[]) => Promise<any[]>;
  mutate: (sql: string, params?: any[]) => Promise<{ rowCount: number; insertId?: number }>;
}
