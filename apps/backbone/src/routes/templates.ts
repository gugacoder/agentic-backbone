import { Hono } from "hono";
import {
  existsSync,
  readdirSync,
  readFileSync,
  copyFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { CONTEXT_DIR } from "../context/paths.js";
import { parseFrontmatter, serializeFrontmatter } from "../context/frontmatter.js";
import { createAgent } from "../agents/manager.js";
import { formatError } from "../utils/errors.js";

export const templateRoutes = new Hono();

const TEMPLATES_DIR = join(CONTEXT_DIR, ".templates", "agents");

// ── Helpers ──────────────────────────────────────────────

function parseArray(val: unknown): string[] {
  if (!val || typeof val !== "string") return [];
  const s = val.trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    return s
      .slice(1, -1)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [s];
}

function readTemplateSlug(slug: string): {
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  suggestedSkills: string[];
  heartbeatEnabled: boolean;
  activeHours: string;
  content: string;
} | null {
  const dir = join(TEMPLATES_DIR, slug);
  const templatePath = join(dir, "TEMPLATE.md");
  if (!existsSync(templatePath)) return null;

  const raw = readFileSync(templatePath, "utf-8");
  const { metadata, content } = parseFrontmatter(raw);

  return {
    name: String(metadata.name ?? slug),
    description: String(metadata.description ?? ""),
    icon: String(metadata.icon ?? "Bot"),
    category: String(metadata.category ?? ""),
    tags: parseArray(metadata.tags),
    suggestedSkills: parseArray(metadata.suggested_skills),
    heartbeatEnabled: metadata.heartbeat_enabled === true,
    activeHours: String(metadata.active_hours ?? "08:00-18:00"),
    content,
  };
}

function listTemplateSlugs(): string[] {
  if (!existsSync(TEMPLATES_DIR)) return [];
  return readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function readPreview(slug: string): { soul: string; conversation: string; heartbeat: string } {
  const dir = join(TEMPLATES_DIR, slug);
  const read = (name: string) => {
    const p = join(dir, name);
    return existsSync(p) ? readFileSync(p, "utf-8") : "";
  };
  return {
    soul: read("SOUL.md"),
    conversation: read("CONVERSATION.md"),
    heartbeat: read("HEARTBEAT.md"),
  };
}

// ── GET /templates/agents ────────────────────────────────

templateRoutes.get("/templates/agents", (c) => {
  const slugs = listTemplateSlugs();
  const templates = slugs
    .map((slug) => {
      const t = readTemplateSlug(slug);
      if (!t) return null;
      return {
        slug,
        name: t.name,
        description: t.description,
        icon: t.icon,
        category: t.category,
        tags: t.tags,
      };
    })
    .filter(Boolean);

  return c.json({ templates });
});

// ── GET /templates/agents/:slug ──────────────────────────

templateRoutes.get("/templates/agents/:slug", (c) => {
  const slug = c.req.param("slug");
  const t = readTemplateSlug(slug);
  if (!t) return c.json({ error: "template nao encontrado" }, 404);

  const preview = readPreview(slug);

  return c.json({
    slug,
    name: t.name,
    description: t.description,
    icon: t.icon,
    category: t.category,
    tags: t.tags,
    content: t.content,
    suggestedSkills: t.suggestedSkills,
    heartbeatEnabled: t.heartbeatEnabled,
    activeHours: t.activeHours,
    preview,
  });
});

// ── POST /agents/from-template ───────────────────────────

templateRoutes.post("/agents/from-template", async (c) => {
  const body = await c.req.json<{
    template: string;
    owner: string;
    slug: string;
    name?: string;
    description?: string;
    enabled?: boolean;
  }>();

  const { template, owner, slug, name, description, enabled } = body;

  if (!template || !owner || !slug) {
    return c.json({ error: "template, owner e slug sao obrigatorios" }, 400);
  }

  const t = readTemplateSlug(template);
  if (!t) return c.json({ error: "template nao encontrado" }, 404);

  // Parse active_hours "HH:MM-HH:MM" into start/end
  const [activeHoursStart, activeHoursEnd] = t.activeHours.includes("-")
    ? t.activeHours.split("-")
    : ["08:00", "18:00"];

  const agentDescription = description ?? t.description;

  let agent;
  try {
    agent = createAgent({
      owner,
      slug,
      description: name ? `# ${name}\n\n${agentDescription}` : agentDescription,
      enabled: enabled ?? false,
      heartbeatEnabled: t.heartbeatEnabled,
      metadata: {
        "active-hours-start": activeHoursStart,
        "active-hours-end": activeHoursEnd,
      },
    });
  } catch (err) {
    return c.json({ error: formatError(err) }, 400);
  }

  // Overwrite default markdown files with template content
  const agentDir = join(CONTEXT_DIR, "agents", `${owner}.${slug}`);
  const templateDir = join(TEMPLATES_DIR, template);

  for (const filename of ["SOUL.md", "CONVERSATION.md", "HEARTBEAT.md"]) {
    const src = join(templateDir, filename);
    const dest = join(agentDir, filename);
    if (existsSync(src)) {
      copyFileSync(src, dest);
    }
  }

  return c.json(agent, 201);
});
