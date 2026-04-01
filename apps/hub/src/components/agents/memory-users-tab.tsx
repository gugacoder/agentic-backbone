import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import Markdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { agentFileQueryOptions } from "@/api/agents";

interface MemoryUsersTabProps {
  agentId: string;
  userFiles: string[];
}

function extractSlug(path: string): string {
  const match = path.match(/users\/([^/]+)\//);
  return match ? match[1] : path;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function initials(slug: string): string {
  return slug
    .split(/[-_.]/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

function UserCard({
  agentId,
  file,
  onSelect,
}: {
  agentId: string;
  file: string;
  onSelect: (file: string) => void;
}) {
  const slug = extractSlug(file);
  const { data, isLoading } = useQuery(agentFileQueryOptions(agentId, file));

  if (isLoading) return <Skeleton className="h-24" />;

  const lines = (data?.content ?? "")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("---"));
  const factCount = lines.length;
  const preview = lines.slice(0, 2).join("\n");

  return (
    <button
      type="button"
      onClick={() => onSelect(file)}
      className="w-full text-left rounded-lg border p-3 flex items-start gap-3 cursor-pointer hover:bg-accent/50 transition-colors"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
        {initials(slug)}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{capitalize(slug)}</span>
          <Badge variant="outline" className="text-xs">
            {factCount} {factCount === 1 ? "fato" : "fatos"}
          </Badge>
        </div>
        {preview && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {preview}
          </p>
        )}
      </div>
    </button>
  );
}

export function MemoryUsersTab({ agentId, userFiles }: MemoryUsersTabProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const selectedSlug = selectedFile ? extractSlug(selectedFile) : "";
  const { data: selectedData } = useQuery({
    ...agentFileQueryOptions(agentId, selectedFile ?? ""),
    enabled: !!selectedFile,
  });

  if (userFiles.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="Nenhuma memoria de usuario"
        description="O agente salva fatos sobre usuarios conforme interage com eles."
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {userFiles.map((file) => (
          <UserCard
            key={file}
            agentId={agentId}
            file={file}
            onSelect={setSelectedFile}
          />
        ))}
      </div>

      <Sheet
        open={!!selectedFile}
        onOpenChange={(open) => {
          if (!open) setSelectedFile(null);
        }}
      >
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{capitalize(selectedSlug)}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none">
            {selectedData && <Markdown>{selectedData.content}</Markdown>}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
