import { Fragment, useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Cog,
  Database,
  FileText,
  Folder,
  FolderOpen,
  HelpCircle,
  House,
  Inbox,
  Map,
  Network,
  NotebookPen,
  Package,
  Pause,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { KbFolderNode, KbNode } from "./utils";
import { KB_SECTION_META, collectAncestors, sectionMetaFor } from "./utils";

interface KbTreeProps {
  root: KbFolderNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

const ICONS: Record<string, LucideIcon> = {
  House,
  Inbox,
  BookOpen,
  Network,
  Map,
  HelpCircle,
  Package,
  NotebookPen,
  CalendarDays,
  Cog,
  Zap,
  Pause,
  Archive,
  Folder,
  Database,
};

function iconFor(relativePath: string, kind: "file" | "folder"): LucideIcon {
  const meta = sectionMetaFor(relativePath);
  if (meta) return ICONS[meta.icon] ?? (kind === "folder" ? Folder : FileText);
  return kind === "folder" ? Folder : FileText;
}

/**
 * Ordem canônica das seções top-level conforme KNOWLEDGE_BASE.md.
 * Pastas desconhecidas caem para o final.
 */
const TOP_LEVEL_ORDER = ["HOME.md", "+", "atlas", "calendar", "effort", "x"];

function sortTopLevel(a: KbNode, b: KbNode): number {
  const ai = TOP_LEVEL_ORDER.indexOf(a.name);
  const bi = TOP_LEVEL_ORDER.indexOf(b.name);
  const av = ai === -1 ? 999 : ai;
  const bv = bi === -1 ? 999 : bi;
  if (av !== bv) return av - bv;
  return a.name.localeCompare(b.name);
}

export function KbTree({ root, selectedPath, onSelect }: KbTreeProps) {
  const expanded = useMemo(() => {
    const set = new Set<string>();
    if (selectedPath) {
      for (const ancestor of collectAncestors(selectedPath)) set.add(ancestor);
    }
    // Atlas, Calendar, Effort abertos por padrão para descoberta
    set.add("kb");
    set.add("kb/atlas");
    set.add("kb/calendar");
    set.add("kb/effort");
    return set;
  }, [selectedPath]);

  const [userExpanded, setUserExpanded] = useState<Set<string>>(new Set());
  const [userCollapsed, setUserCollapsed] = useState<Set<string>>(new Set());

  function toggle(path: string) {
    const isCurrentlyOpen =
      (expanded.has(path) || userExpanded.has(path)) &&
      !userCollapsed.has(path);
    const nextExp = new Set(userExpanded);
    const nextCol = new Set(userCollapsed);
    if (isCurrentlyOpen) {
      nextExp.delete(path);
      nextCol.add(path);
    } else {
      nextCol.delete(path);
      nextExp.add(path);
    }
    setUserExpanded(nextExp);
    setUserCollapsed(nextCol);
  }

  function isOpen(path: string): boolean {
    if (userCollapsed.has(path)) return false;
    return expanded.has(path) || userExpanded.has(path);
  }

  const topChildren = useMemo(
    () => [...root.children].sort(sortTopLevel),
    [root.children],
  );

  return (
    <TooltipProvider delay={300}>
      <nav className="text-sm" aria-label="Knowledge base">
        <ul className="space-y-0.5">
          {topChildren.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelect}
              toggle={toggle}
              isOpen={isOpen}
            />
          ))}
        </ul>
      </nav>
    </TooltipProvider>
  );
}

interface TreeRowProps {
  node: KbNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  toggle: (path: string) => void;
  isOpen: (path: string) => boolean;
}

function TreeRow({
  node,
  depth,
  selectedPath,
  onSelect,
  toggle,
  isOpen,
}: TreeRowProps) {
  const relative = node.path.startsWith("kb/")
    ? node.path.slice(3)
    : node.path;
  const meta = sectionMetaFor(relative);
  const open = node.type === "folder" && isOpen(node.path);
  const Icon = iconFor(
    relative,
    node.type === "folder" ? "folder" : "file",
  );
  const FolderGlyph = open ? FolderOpen : Folder;
  const DisplayIcon = meta
    ? Icon
    : node.type === "folder"
      ? FolderGlyph
      : FileText;

  const isSelected = selectedPath === node.path;
  const indent = { paddingLeft: `${depth * 0.75 + 0.5}rem` };

  const label =
    depth === 0 && meta ? meta.label : node.name;

  if (node.type === "folder") {
    const empty = node.fileCount === 0;
    return (
      <li>
        <button
          type="button"
          onClick={() => toggle(node.path)}
          className={cn(
            "w-full flex items-center gap-1.5 rounded px-1.5 py-1 text-left",
            "hover:bg-accent/50 transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
          style={indent}
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <DisplayIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{label}</span>
          {meta && depth === 0 ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    aria-label="Descrição"
                    className="text-muted-foreground/70 text-[10px] cursor-help"
                  >
                    ?
                  </span>
                }
              />
              <TooltipContent>{meta.description}</TooltipContent>
            </Tooltip>
          ) : null}
          <span className="ml-auto flex items-center gap-1">
            {empty ? (
              <Badge variant="outline" className="text-[10px] px-1 h-4">
                vazio
              </Badge>
            ) : (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {node.fileCount}
              </span>
            )}
          </span>
        </button>
        {open && node.children.length > 0 ? (
          <ul className="space-y-0.5">
            {node.children.map((child) => (
              <TreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                toggle={toggle}
                isOpen={isOpen}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  // file
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className={cn(
          "w-full flex items-center gap-1.5 rounded px-1.5 py-1 text-left",
          "hover:bg-accent/50 transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          isSelected && "bg-accent text-accent-foreground font-medium",
        )}
        style={indent}
      >
        <span className="size-3.5 shrink-0" aria-hidden />
        <DisplayIcon
          className={cn(
            "size-4 shrink-0",
            isSelected ? "text-foreground" : "text-muted-foreground",
          )}
        />
        <span className="truncate">{label}</span>
      </button>
    </li>
  );
}

// Re-export meta for consumers (danger zone labels etc.)
export { KB_SECTION_META };
