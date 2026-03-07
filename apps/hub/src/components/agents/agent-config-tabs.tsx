import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, MessageSquare, Heart } from "lucide-react";
import { agentFileQueryOptions, saveAgentFile } from "@/api/agents";
import { MarkdownEditor } from "@/components/shared/markdown-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const subtabs = [
  { value: "identity", label: "Identidade", icon: FileText, filename: "SOUL.md" },
  { value: "conversation", label: "Conversa", icon: MessageSquare, filename: "CONVERSATION.md" },
  { value: "heartbeat", label: "Heartbeat", icon: Heart, filename: "HEARTBEAT.md" },
] as const;

type SubtabValue = (typeof subtabs)[number]["value"];

interface AgentConfigTabsProps {
  agentId: string;
  subtab?: string;
}

export function AgentConfigTabs({ agentId, subtab }: AgentConfigTabsProps) {
  const navigate = useNavigate();
  const activeSubtab = (
    subtabs.some((s) => s.value === subtab) ? subtab : "identity"
  ) as SubtabValue;

  const activeConfig = subtabs.find((s) => s.value === activeSubtab)!;

  function handleSubtabChange(value: SubtabValue) {
    navigate({
      to: "/agents/$id",
      params: { id: agentId },
      search: { tab: "config", subtab: value },
      replace: true,
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {/* Vertical sub-tab navigation */}
      <nav className="flex flex-row gap-1 sm:w-48 sm:flex-col sm:border-r sm:pr-4">
        {subtabs.map((s) => (
          <button
            key={s.value}
            onClick={() => handleSubtabChange(s.value)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left",
              activeSubtab === s.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <s.icon className="size-4 shrink-0" />
            {s.label}
          </button>
        ))}
      </nav>

      {/* Editor area */}
      <div className="flex-1 min-w-0">
        <FileEditor
          key={`${agentId}-${activeConfig.filename}`}
          agentId={agentId}
          filename={activeConfig.filename}
        />
      </div>
    </div>
  );
}

function FileEditor({ agentId, filename }: { agentId: string; filename: string }) {
  const { data, isLoading, isError } = useQuery(agentFileQueryOptions(agentId, filename));

  const [content, setContent] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync fetched content to local state once
  useEffect(() => {
    if (data) {
      setContent(data.content);
    } else if (isError) {
      // File doesn't exist yet — start empty
      setContent("");
    }
  }, [data, isError]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedRef.current) clearTimeout(savedRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      setSaveStatus("idle");

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedRef.current) clearTimeout(savedRef.current);

      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await saveAgentFile(agentId, filename, value);
          setSaveStatus("saved");
          savedRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
        } catch {
          setSaveStatus("error");
        }
      }, 2000);
    },
    [agentId, filename],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <MarkdownEditor
      value={content ?? ""}
      onChange={handleChange}
      saveStatus={saveStatus}
      placeholder={`Escreva o conteudo de ${filename}...`}
    />
  );
}
