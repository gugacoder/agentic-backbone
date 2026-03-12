import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

export interface LoadedMetadata {
  data: Record<string, unknown>;
  content: string;
  filePath: string;
}

/**
 * Loader universal de metadata — DRY.
 * Tenta {basename}.yaml (YAML puro), senão {basename}.md (frontmatter YAML).
 */
export function loadMetadata(dir: string, basename: string): LoadedMetadata | null {
  const yamlPath = join(dir, `${basename}.yaml`);
  if (existsSync(yamlPath)) {
    const raw = readFileSync(yamlPath, "utf-8");
    const parsed = yaml.load(raw);
    if (parsed && typeof parsed === "object") {
      const data = { ...parsed } as Record<string, unknown>;
      // Extract `content` key as markdown body (convention for converted .md → .yaml)
      const content = typeof data.content === "string" ? data.content : "";
      if ("content" in data) delete data.content;
      return { data, content, filePath: yamlPath };
    }
  }

  const mdPath = join(dir, `${basename}.md`);
  if (existsSync(mdPath)) {
    const raw = readFileSync(mdPath, "utf-8");
    const result = extractFrontmatterYaml(raw);
    if (result.data) {
      return { data: result.data, content: result.content, filePath: mdPath };
    }
  }

  return null;
}

/**
 * Extrai frontmatter YAML de markdown usando js-yaml (suporta nested).
 */
export function extractFrontmatterYaml(raw: string): { data: Record<string, unknown> | null; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: null, content: raw };

  const parsed = yaml.load(match[1]);
  if (parsed && typeof parsed === "object") {
    return { data: parsed as Record<string, unknown>, content: match[2] };
  }
  return { data: null, content: raw };
}
