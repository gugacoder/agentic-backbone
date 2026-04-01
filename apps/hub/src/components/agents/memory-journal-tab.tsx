import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import Markdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { agentFileQueryOptions } from "@/api/agents";

interface MemoryJournalTabProps {
  agentId: string;
  journalFiles: string[];
}

function extractDate(path: string): string {
  const match = path.match(/journal\/(\d{4}-\d{2}-\d{2})\//);
  if (!match) return path;
  const [y, m, d] = match[1].split("-");
  return `${d}/${m}/${y}`;
}

function JournalEntry({ agentId, file }: { agentId: string; file: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery(agentFileQueryOptions(agentId, file));

  if (isLoading) return <Skeleton className="h-24" />;
  if (!data) return null;

  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left rounded-lg border p-3 space-y-2 cursor-pointer hover:bg-accent/50 transition-colors"
    >
      <Badge variant="secondary">{extractDate(file)}</Badge>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <div className={expanded ? "" : "line-clamp-3"}>
          <Markdown>{data.content}</Markdown>
        </div>
      </div>
    </button>
  );
}

export function MemoryJournalTab({ agentId, journalFiles }: MemoryJournalTabProps) {
  if (journalFiles.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Nenhuma entrada no diario"
        description="O agente registra entradas de diario automaticamente durante suas interacoes."
      />
    );
  }

  return (
    <div className="space-y-3">
      {journalFiles.map((file) => (
        <JournalEntry key={file} agentId={agentId} file={file} />
      ))}
    </div>
  );
}
