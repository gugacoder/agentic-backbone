import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Loader2,
  Menu as MenuIcon,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import {
  agentFilesQueryOptions,
  agentMemoryStatusQueryOptions,
  resetAgentMemory,
  syncAgentMemory,
} from "@/api/agents";
import { KbTree } from "./kb-tree";
import { KbFileView } from "./kb-file-view";
import { KbSearch } from "./kb-search";
import { buildKbTree } from "./utils";

interface KbExplorerProps {
  agentId: string;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

export function KbExplorer({ agentId }: KbExplorerProps) {
  const queryClient = useQueryClient();

  const { data: allFiles, isLoading: filesLoading } = useQuery(
    agentFilesQueryOptions(agentId),
  );
  const { data: status } = useQuery(agentMemoryStatusQueryOptions(agentId));

  const kbPaths = useMemo(
    () => (allFiles ?? []).filter((f) => f.startsWith("kb/")),
    [allFiles],
  );

  const root = useMemo(() => buildKbTree(kbPaths), [kbPaths]);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Seleção inicial: HOME.md quando existir, senão primeiro arquivo disponível
  useEffect(() => {
    if (selectedPath) return;
    if (kbPaths.includes("kb/HOME.md")) {
      setSelectedPath("kb/HOME.md");
      return;
    }
    const first = kbPaths[0];
    if (first) setSelectedPath(first);
  }, [kbPaths, selectedPath]);

  // Se o arquivo selecionado foi removido (após sync ou reset), limpar seleção
  useEffect(() => {
    if (selectedPath && !kbPaths.includes(selectedPath)) {
      setSelectedPath(null);
    }
  }, [kbPaths, selectedPath]);

  const syncMutation = useMutation({
    mutationFn: () => syncAgentMemory(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["agents", agentId, "memory", "status"],
      });
      queryClient.invalidateQueries({
        queryKey: ["agents", agentId, "files"],
      });
      toast.success("KB sincronizada");
    },
    onError: () => toast.error("Erro ao sincronizar KB"),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetAgentMemory(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["agents", agentId, "memory"],
      });
      toast.success("Índice da memória limpo");
    },
    onError: () => toast.error("Erro ao limpar índice"),
  });

  const syncing = syncMutation.isPending;
  const resetting = resetMutation.isPending;

  function navigate(path: string) {
    setSelectedPath(path);
    setMobileTreeOpen(false);
  }

  const treeContent = (
    <KbTree
      root={root}
      selectedPath={selectedPath}
      onSelect={navigate}
    />
  );

  const isEmpty = !filesLoading && kbPaths.length === 0;

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <KbSearch agentId={agentId} onSelect={navigate} />

        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncing || resetting}
        >
          {syncing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          <span className="hidden sm:inline ml-1">
            {syncing ? "Sincronizando…" : "Sincronizar"}
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Ações avançadas"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => syncMutation.mutate()}
              disabled={syncing || resetting}
            >
              <RefreshCw className="size-4" />
              Re-ingerir tudo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setResetConfirmOpen(true)}
              disabled={syncing || resetting}
            >
              <Trash2 className="size-4" />
              Limpar índice…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Diálogo de confirmação do reset */}
      <ConfirmResetDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        onConfirm={() => resetMutation.mutate()}
      />

      {/* Stats */}
      <p className="text-xs text-muted-foreground">
        {kbPaths.length} arquivos em kb/ ·{" "}
        {status?.chunkCount ?? 0} chunks indexados
        {status?.lastSync ? ` · sync ${formatRelative(status.lastSync)}` : ""}
      </p>

      {/* Body */}
      {isEmpty ? (
        <EmptyState
          icon={<BookOpen />}
          title="KB vazia"
          description="Este agente ainda não populou a knowledge base. A estrutura segue o modelo LYT descrito em KNOWLEDGE_BASE.md (Atlas · Calendar · Efforts)."
          action={
            <Button onClick={() => syncMutation.mutate()} disabled={syncing}>
              {syncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span className="ml-1">Sincronizar</span>
            </Button>
          }
        />
      ) : (
        <div
          className={cn(
            "grid gap-4 min-h-0 flex-1",
            "grid-cols-1 md:grid-cols-[280px_1fr]",
          )}
        >
          {/* Tree — desktop */}
          <aside className="hidden md:block min-h-0 overflow-y-auto border rounded-md p-2">
            {filesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6" />
                <Skeleton className="h-6" />
                <Skeleton className="h-6" />
              </div>
            ) : (
              treeContent
            )}
          </aside>

          {/* Tree — mobile */}
          <div className="md:hidden">
            <Sheet open={mobileTreeOpen} onOpenChange={setMobileTreeOpen}>
              <SheetTrigger
                render={
                  <Button variant="outline" size="sm">
                    <MenuIcon className="size-4" />
                    <span className="ml-1">Navegar</span>
                  </Button>
                }
              />
              <SheetContent
                side="left"
                className="w-[85vw] max-w-sm overflow-y-auto p-4"
              >
                <h2 className="text-sm font-medium mb-3">
                  Knowledge Base
                </h2>
                {filesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6" />
                    <Skeleton className="h-6" />
                  </div>
                ) : (
                  treeContent
                )}
              </SheetContent>
            </Sheet>
          </div>

          {/* File view */}
          <section className="min-w-0 min-h-0 overflow-y-auto">
            {selectedPath ? (
              <KbFileView
                agentId={agentId}
                path={selectedPath}
                allPaths={kbPaths}
                onNavigate={navigate}
              />
            ) : (
              <EmptyState
                icon={<BookOpen />}
                title="Selecione um arquivo"
                description="Escolha um item na árvore à esquerda para visualizar seu conteúdo."
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

interface ConfirmResetDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}

function ConfirmResetDialog({
  open,
  onOpenChange,
  onConfirm,
}: ConfirmResetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Limpar índice da KB</DialogTitle>
          <DialogDescription>
            Remove todos os chunks e embeddings do índice. Os arquivos em{" "}
            <code className="font-mono">kb/</code> NÃO são apagados. A próxima
            sincronização reconstruirá o índice.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Limpar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
