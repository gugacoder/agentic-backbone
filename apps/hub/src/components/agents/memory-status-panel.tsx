import { useQuery } from "@tanstack/react-query";
import { FileText, Layers, Brain } from "lucide-react";
import Markdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  agentMemoryStatusQueryOptions,
  agentFileQueryOptions,
} from "@/api/agents";
import type { MemoryStatus } from "@/api/agents";

interface MemoryStatusPanelProps {
  agentId: string;
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `ha ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours}h`;
  const days = Math.floor(hours / 24);
  return `ha ${days}d`;
}

function isContentEmpty(content: string): boolean {
  const stripped = content
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/^#+\s*$/gm, "")
    .replace(/^[-*]\s*$/gm, "")
    .replace(/^\s*$/gm, "")
    .trim();
  return stripped.length === 0;
}

export function MemoryStatusPanel({ agentId }: MemoryStatusPanelProps) {
  const { data: status, isLoading: statusLoading } = useQuery(
    agentMemoryStatusQueryOptions(agentId),
  );
  const { data: memoryFile, isLoading: fileLoading } = useQuery({
    ...agentFileQueryOptions(agentId, "MEMORY.md"),
  });

  return (
    <div className="space-y-6">
      {/* Status cards */}
      {statusLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : status ? (
        <StatusCards status={status} />
      ) : null}

      {/* MEMORY.md viewer */}
      {fileLoading ? (
        <Skeleton className="h-48" />
      ) : memoryFile && !isContentEmpty(memoryFile.content) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Fatos Aprendidos
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <Markdown>{memoryFile.content}</Markdown>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Fatos Aprendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<Brain />}
              title="Nenhum fato aprendido ainda"
              description="O agente extrai fatos automaticamente a cada 20 mensagens de conversa."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusCards({ status }: { status: MemoryStatus }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Arquivos indexados
            </CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(status.fileCount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chunks</CardTitle>
            <Layers className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(status.chunkCount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {status.lastSync && (
        <p className="text-xs text-muted-foreground">
          Ultima sincronizacao: {formatRelativeTime(status.lastSync)}
        </p>
      )}
    </div>
  );
}
