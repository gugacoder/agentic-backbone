import { Check, Download, FileText, FilePlus, FolderSearch, Globe, Loader2, Pencil, Search, Terminal, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils.js";

export type ToolActivityState = "call" | "partial-call" | "result";

export interface ToolActivityProps {
  toolName: string;
  state: ToolActivityState;
  args?: Record<string, unknown>;
  className?: string;
  iconMap?: Partial<Record<string, LucideIcon>>;
}

export const defaultToolIconMap: Record<string, LucideIcon> = {
  WebSearch: Globe,
  Bash: Terminal,
  Read: FileText,
  Edit: Pencil,
  Write: FilePlus,
  Grep: Search,
  Glob: FolderSearch,
  WebFetch: Download,
};

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveIcon(toolName: string, iconMap: Record<string, LucideIcon | undefined>): LucideIcon {
  return iconMap[toolName] ?? Wrench;
}

export function ToolActivity({ toolName, state, className, iconMap }: ToolActivityProps) {
  const mergedIconMap = iconMap ? { ...defaultToolIconMap, ...iconMap } : defaultToolIconMap;
  const Icon = resolveIcon(toolName, mergedIconMap);
  const isActive = state === "call" || state === "partial-call";
  const displayName = formatToolName(toolName);

  return (
    <div className={cn("flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm", className)}>
      <span className="text-primary shrink-0" aria-hidden="true">
        <Icon size={14} />
      </span>
      <span className="font-medium font-mono">{displayName}</span>
      <span className="ml-auto text-muted-foreground">
        {isActive ? (
          <Loader2 size={14} className="animate-spin" aria-label="Executando..." />
        ) : (
          <Check size={14} className="text-primary" aria-label="Concluido" />
        )}
      </span>
    </div>
  );
}
