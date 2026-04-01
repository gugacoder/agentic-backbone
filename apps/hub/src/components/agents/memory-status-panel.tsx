import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Users, RefreshCw, Trash2, Brain } from "lucide-react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  agentMemoryStatusQueryOptions,
  agentFileQueryOptions,
  agentFilesQueryOptions,
  syncAgentMemory,
  resetAgentMemory,
} from "@/api/agents";
import { MemorySearchBox } from "./memory-search-box";
import { MemoryJournalTab } from "./memory-journal-tab";
import { MemoryUsersTab } from "./memory-users-tab";

interface MemoryStatusPanelProps {
  agentId: string;
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
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery(
    agentMemoryStatusQueryOptions(agentId),
  );
  const { data: memoryFile, isLoading: fileLoading } = useQuery({
    ...agentFileQueryOptions(agentId, "MEMORY.md"),
  });
  const { data: allFiles, isLoading: filesLoading } = useQuery(
    agentFilesQueryOptions(agentId),
  );

  const journalFiles = useMemo(
    () =>
      (allFiles ?? [])
        .filter((f) => f.startsWith("journal/") && f.endsWith("/MEMORY.md"))
        .sort()
        .reverse(),
    [allFiles],
  );

  const userFiles = useMemo(
    () =>
      (allFiles ?? []).filter(
        (f) => f.startsWith("users/") && f.endsWith("/USER.md"),
      ),
    [allFiles],
  );

  const syncMutation = useMutation({
    mutationFn: () => syncAgentMemory(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["agents", agentId, "memory", "status"],
      });
      queryClient.invalidateQueries({
        queryKey: ["agents", agentId, "files"],
      });
      toast.success("Memoria sincronizada");
    },
    onError: () => {
      toast.error("Erro ao sincronizar memoria");
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetAgentMemory(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["agents", agentId, "memory"],
      });
      toast.success("Memoria resetada");
    },
    onError: () => {
      toast.error("Erro ao resetar memoria");
    },
  });

  const syncing = syncMutation.isPending;
  const resetting = resetMutation.isPending;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="facts">
        {/* Header: tabs + actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList variant="line">
            <TabsTrigger value="facts">
              <BookOpen className="size-4" />
              <span className="hidden sm:inline">Fatos</span>
            </TabsTrigger>
            <TabsTrigger value="journal">
              <CalendarDays className="size-4" />
              <span className="hidden sm:inline">Diario</span>
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="size-4" />
              <span className="hidden sm:inline">Pessoas</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncing || resetting}
            >
              <RefreshCw
                className={`size-4 ${syncing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline ml-1">
                {syncing ? "Sincronizando..." : "Sincronizar"}
              </span>
            </Button>
            <ConfirmDialog
              title="Limpar Memoria"
              description="Todos os fatos e chunks da memoria do agente serao removidos. O MEMORY.md sera mantido. Esta acao eh irreversivel."
              onConfirm={() => resetMutation.mutate()}
              destructive
            >
              <Button
                variant="destructive"
                size="sm"
                disabled={syncing || resetting}
              >
                <Trash2 className="size-4" />
                <span className="hidden sm:inline ml-1">
                  {resetting ? "Limpando..." : "Limpar"}
                </span>
              </Button>
            </ConfirmDialog>
          </div>
        </div>

        {/* Stats bar */}
        {statusLoading || filesLoading ? (
          <Skeleton className="h-6 w-64" />
        ) : (
          <p className="text-xs text-muted-foreground">
            {status?.fileCount ?? 0} arquivos &middot;{" "}
            {status?.chunkCount ?? 0} chunks &middot;{" "}
            {journalFiles.length} {journalFiles.length === 1 ? "entrada" : "entradas"} &middot;{" "}
            {userFiles.length} {userFiles.length === 1 ? "pessoa" : "pessoas"}
            {status?.lastSync && (
              <> &middot; sync {formatRelativeTime(status.lastSync)}</>
            )}
          </p>
        )}

        {/* Tab: Fatos */}
        <TabsContent value="facts">
          {fileLoading ? (
            <Skeleton className="h-48" />
          ) : memoryFile && !isContentEmpty(memoryFile.content) ? (
            <Card>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-4">
                <Markdown>{memoryFile.content}</Markdown>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={<Brain />}
              title="Nenhum fato aprendido ainda"
              description="O agente extrai fatos automaticamente a cada 20 mensagens de conversa."
            />
          )}
        </TabsContent>

        {/* Tab: Diario */}
        <TabsContent value="journal">
          {filesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            <MemoryJournalTab agentId={agentId} journalFiles={journalFiles} />
          )}
        </TabsContent>

        {/* Tab: Pessoas */}
        <TabsContent value="users">
          {filesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            <MemoryUsersTab agentId={agentId} userFiles={userFiles} />
          )}
        </TabsContent>
      </Tabs>

      {/* Busca Semantica — sempre visivel */}
      <Card>
        <CardContent className="pt-4">
          <MemorySearchBox agentId={agentId} />
        </CardContent>
      </Card>
    </div>
  );
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
