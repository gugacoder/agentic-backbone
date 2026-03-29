import { Check, Download, FileText, FilePlus, FolderSearch, Globe, Loader2, Pencil, Search, Terminal, Wrench, type LucideIcon } from "lucide-react";

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
    <div className={`ai-chat-tool-activity${className ? ` ${className}` : ""}`}>
      <span className="ai-chat-tool-activity-icon" aria-hidden="true">
        <Icon size={14} />
      </span>
      <span className="ai-chat-tool-activity-name">{displayName}</span>
      <span className="ai-chat-tool-activity-status">
        {isActive ? (
          <Loader2 size={14} className="ai-chat-tool-activity-spinner" aria-label="Executando..." />
        ) : (
          <Check size={14} className="ai-chat-tool-activity-check" aria-label="Concluido" />
        )}
      </span>
    </div>
  );
}
