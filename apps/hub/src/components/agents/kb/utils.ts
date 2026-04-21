import yaml from "js-yaml";

export type KbFileNode = {
  type: "file";
  name: string;
  path: string;
};

export type KbFolderNode = {
  type: "folder";
  name: string;
  path: string;
  children: KbNode[];
  fileCount: number;
};

export type KbNode = KbFileNode | KbFolderNode;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown> | null;
  body: string;
} {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return { frontmatter: null, body: content };
  try {
    const parsed = yaml.load(match[1]);
    if (parsed && typeof parsed === "object") {
      return { frontmatter: parsed as Record<string, unknown>, body: match[2] };
    }
  } catch {
    // YAML inválido — devolver corpo inteiro
  }
  return { frontmatter: null, body: content };
}

export function buildKbTree(paths: string[]): KbFolderNode {
  const root: KbFolderNode = {
    type: "folder",
    name: "kb",
    path: "kb",
    children: [],
    fileCount: 0,
  };

  for (const full of paths) {
    if (!full.startsWith("kb/") && full !== "kb") continue;
    const parts = full.split("/");
    let cursor: KbFolderNode = root;
    for (let i = 1; i < parts.length; i++) {
      const segment = parts[i];
      const isLast = i === parts.length - 1;
      const prefix = parts.slice(0, i + 1).join("/");

      if (isLast) {
        cursor.children.push({ type: "file", name: segment, path: prefix });
        continue;
      }

      let folder = cursor.children.find(
        (c): c is KbFolderNode => c.type === "folder" && c.name === segment,
      );
      if (!folder) {
        folder = {
          type: "folder",
          name: segment,
          path: prefix,
          children: [],
          fileCount: 0,
        };
        cursor.children.push(folder);
      }
      cursor = folder;
    }
  }

  sortTree(root);
  computeCounts(root);
  return root;
}

function sortTree(node: KbFolderNode): void {
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) {
    if (child.type === "folder") sortTree(child);
  }
}

function computeCounts(node: KbFolderNode): number {
  let count = 0;
  for (const child of node.children) {
    if (child.type === "file") {
      count += 1;
    } else {
      count += computeCounts(child);
    }
  }
  node.fileCount = count;
  return count;
}

export function findNode(
  root: KbFolderNode,
  path: string,
): KbNode | null {
  if (root.path === path) return root;
  for (const child of root.children) {
    if (child.path === path) return child;
    if (child.type === "folder") {
      const found = findNode(child, path);
      if (found) return found;
    }
  }
  return null;
}

export function collectAncestors(path: string): string[] {
  const parts = path.split("/");
  const chain: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    chain.push(parts.slice(0, i + 1).join("/"));
  }
  return chain;
}

/**
 * Resolve um wikilink LYT contra a lista de caminhos da KB.
 * Tenta, em ordem:
 *   1. `kb/{target}.md` literal
 *   2. `kb/atlas/concepts/{target}.md`
 *   3. `kb/{target}/index.md`
 *   4. match parcial pelo nome do arquivo (último recurso)
 */
export function resolveWikilink(
  target: string,
  allPaths: string[],
): string | null {
  const normalized = target.replace(/^\/+|\/+$/g, "");
  const candidates = [
    `kb/${normalized}.md`,
    `kb/atlas/concepts/${normalized}.md`,
    `kb/${normalized}/index.md`,
  ];
  for (const c of candidates) {
    if (allPaths.includes(c)) return c;
  }

  const basename = normalized.split("/").pop();
  if (basename) {
    const needle = basename.endsWith(".md") ? basename : `${basename}.md`;
    const match = allPaths.find(
      (p) => p.startsWith("kb/") && p.endsWith(`/${needle}`),
    );
    if (match) return match;
  }

  return null;
}

const WIKI_PREFIX = "#__wiki__/";

/**
 * Transforma `[[target]]` / `[[target|alias]]` em `[alias](#__wiki__/ENCODED)`
 * para que `react-markdown` emita um `<a>` com href detectável pelo override.
 * O alvo é URI-encoded para não conflitar com separadores.
 */
export function preprocessWikilinks(content: string): string {
  return content.replace(/\[\[([^\]]+?)\]\]/g, (_m, inner) => {
    const [rawTarget, rawAlias] = String(inner).split("|");
    const target = rawTarget.trim();
    const alias = (rawAlias ?? target).trim();
    const escaped = alias.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
    return `[${escaped}](${WIKI_PREFIX}${encodeURIComponent(target)})`;
  });
}

export function extractWikiTarget(href: string): string | null {
  if (!href.startsWith(WIKI_PREFIX)) return null;
  try {
    return decodeURIComponent(href.slice(WIKI_PREFIX.length));
  } catch {
    return null;
  }
}

export type KbSectionMeta = {
  icon:
    | "House"
    | "Inbox"
    | "BookOpen"
    | "Network"
    | "Map"
    | "HelpCircle"
    | "Package"
    | "NotebookPen"
    | "CalendarDays"
    | "Cog"
    | "Zap"
    | "Pause"
    | "Archive"
    | "Folder"
    | "Database";
  label: string;
  description: string;
};

/**
 * Metadados por caminho relativo (sem o prefixo `kb/`).
 * Usado para decorar a árvore com ícone Lucide + descrição por seção
 * (derivada de KNOWLEDGE_BASE.md).
 */
export const KB_SECTION_META: Record<string, KbSectionMeta> = {
  "HOME.md": {
    icon: "House",
    label: "HOME.md",
    description: "Root MOC — índice mestre da KB.",
  },
  "+": {
    icon: "Inbox",
    label: "Inbox",
    description: "Arquivos transitórios aguardando ingestão.",
  },
  atlas: {
    icon: "BookOpen",
    label: "Atlas",
    description: "Camada de referência permanente (atemporal).",
  },
  "atlas/concepts": {
    icon: "BookOpen",
    label: "Concepts",
    description: "Artigos atômicos — uma ideia por nota.",
  },
  "atlas/connections": {
    icon: "Network",
    label: "Connections",
    description: "Sínteses transversais ligando 2+ conceitos.",
  },
  "atlas/maps": {
    icon: "Map",
    label: "Maps",
    description: "Notas de ordem superior (MOCs e Hubs).",
  },
  "atlas/qa": {
    icon: "HelpCircle",
    label: "Q&A",
    description: "Perguntas e respostas finalizadas.",
  },
  "atlas/works": {
    icon: "Package",
    label: "Works",
    description: "Entregas finais — copy, relatórios, drafts publicados.",
  },
  calendar: {
    icon: "CalendarDays",
    label: "Calendar",
    description: "Camada temporal — notas datadas.",
  },
  "calendar/notes": {
    icon: "NotebookPen",
    label: "Notes",
    description: "Logs diários de conversa (append-only).",
  },
  "calendar/events": {
    icon: "CalendarDays",
    label: "Events",
    description: "Notas atreladas a datas (passadas ou futuras).",
  },
  "calendar/system": {
    icon: "Cog",
    label: "System",
    description:
      "Registros gerados por código — não editar à mão (invariante #9).",
  },
  effort: {
    icon: "Zap",
    label: "Efforts",
    description: "Trabalho em andamento que gradua para Atlas quando pronto.",
  },
  "effort/on": {
    icon: "Zap",
    label: "On",
    description: "Projetos ativos.",
  },
  "effort/simmering": {
    icon: "Pause",
    label: "Simmering",
    description: "Projetos pausados — podem retornar.",
  },
  "effort/off": {
    icon: "Archive",
    label: "Off",
    description: "Projetos abandonados — mantidos como registro.",
  },
  x: {
    icon: "Database",
    label: "x/",
    description: "Artefatos não-markdown (binários e estado de sistemas).",
  },
  "x/files": {
    icon: "Folder",
    label: "Files",
    description: "Binários preservados do inbox.",
  },
};

export function sectionMetaFor(relativePath: string): KbSectionMeta | null {
  return KB_SECTION_META[relativePath] ?? null;
}
