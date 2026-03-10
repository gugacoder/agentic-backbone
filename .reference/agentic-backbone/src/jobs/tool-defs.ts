import { readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import type { ToolDefinition } from "../agent/tool-defs.js";

type ToolModule = { create: () => ToolDefinition };

const defsDir = join(dirname(fileURLToPath(import.meta.url)), "defs");

const toolModules: ToolModule[] = await Promise.all(
  readdirSync(defsDir)
    .filter((f) => (f.endsWith(".js") || (f.endsWith(".ts") && !f.endsWith(".d.ts"))) && !f.startsWith("_"))
    .map((f) => import(pathToFileURL(join(defsDir, f)).href) as Promise<ToolModule>)
);

export function createJobTools(): ToolDefinition[] {
  return toolModules.map(({ create }) => create());
}
