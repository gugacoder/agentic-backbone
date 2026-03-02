export interface ParsedMarkdown {
  metadata: Record<string, unknown>;
  content: string;
}

export function parseFrontmatter(raw: string): ParsedMarkdown {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { metadata: {}, content: raw };

  const yamlBlock = match[1];
  const content = match[2];

  const metadata: Record<string, unknown> = {};
  for (const line of yamlBlock.split(/\r?\n/)) {
    const kv = line.match(/^([\w][\w-]*):\s*(.+)$/);
    if (!kv) continue;
    const val = kv[2].trim();
    if (val === "true") metadata[kv[1]] = true;
    else if (val === "false") metadata[kv[1]] = false;
    else if (/^\d+$/.test(val)) metadata[kv[1]] = Number(val);
    else metadata[kv[1]] = val.replace(/^["']|["']$/g, "");
  }

  return { metadata, content };
}

export function serializeFrontmatter(
  metadata: Record<string, unknown>,
  content: string
): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      // Quote strings that contain special YAML characters
      const needsQuoting = /[:#\[\]{}&*!|>'"%@`]/.test(value) || value === "";
      lines.push(`${key}: ${needsQuoting ? `"${value.replace(/"/g, '\\"')}"` : value}`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  lines.push("---");
  return lines.join("\n") + "\n" + content;
}
