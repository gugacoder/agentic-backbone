import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, Loader2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { agentFileQueryOptions, saveAgentFile } from "@/api/agents";
import { KbFrontmatter } from "./kb-frontmatter";
import { KbMarkdown } from "./kb-markdown";
import { KbSaveDialog } from "./kb-save-dialog";
import { parseFrontmatter } from "./utils";

interface KbFileViewProps {
  agentId: string;
  path: string;
  allPaths: string[];
  onNavigate: (path: string) => void;
}

function isSystemGenerated(path: string): boolean {
  return path.startsWith("kb/calendar/system/");
}

export function KbFileView({
  agentId,
  path,
  allPaths,
  onNavigate,
}: KbFileViewProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery(
    agentFileQueryOptions(agentId, path),
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Reset edição quando trocar de arquivo
  useEffect(() => {
    setEditing(false);
    setDraft("");
    setSaveDialogOpen(false);
  }, [path]);

  const saveMutation = useMutation({
    mutationFn: async (note: string) =>
      saveAgentFile(agentId, path, draft, note || undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["agents", agentId, "files", path],
      });
      await queryClient.invalidateQueries({
        queryKey: ["agents", agentId, "files"],
      });
      setEditing(false);
      setSaveDialogOpen(false);
      toast.success("Arquivo salvo");
    },
    onError: (err) => {
      toast.error(
        `Erro ao salvar: ${err instanceof Error ? err.message : "desconhecido"}`,
      );
    },
  });

  const parsed = useMemo(() => {
    if (!data) return { frontmatter: null, body: "" };
    return parseFrontmatter(data.content);
  }, [data]);

  function copyPath() {
    navigator.clipboard.writeText(path).then(
      () => toast.success("Caminho copiado"),
      () => toast.error("Falha ao copiar"),
    );
  }

  function startEdit() {
    if (!data) return;
    setDraft(data.content);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft("");
    setEditing(false);
  }

  const systemFile = isSystemGenerated(path);

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <Breadcrumb path={path} />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={copyPath}
            title="Copiar caminho"
          >
            <Copy className="size-4" />
            <span className="hidden sm:inline ml-1">Copiar</span>
          </Button>
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelEdit}
                disabled={saveMutation.isPending}
              >
                <X className="size-4" />
                <span className="hidden sm:inline ml-1">Cancelar</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setSaveDialogOpen(true)}
                disabled={saveMutation.isPending || draft === data?.content}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                <span className="hidden sm:inline ml-1">Salvar</span>
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={startEdit}
              disabled={isLoading || !data}
            >
              <Pencil className="size-4" />
              <span className="hidden sm:inline ml-1">Editar</span>
            </Button>
          )}
        </div>
      </div>

      {systemFile ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Arquivo gerado pelo sistema</p>
            <p className="text-xs">
              Registros em <code className="font-mono">calendar/system/</code>{" "}
              são escritos por código (invariante #9 do KNOWLEDGE_BASE.md).
              Edite apenas se entender o impacto.
            </p>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
        </div>
      ) : isError || !data ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-4 text-sm text-destructive">
          Falha ao carregar {path}.
        </div>
      ) : editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={cn(
            "font-mono text-[13px] leading-relaxed min-h-[60vh]",
            "whitespace-pre",
          )}
          spellCheck={false}
        />
      ) : (
        <div className="space-y-4 min-w-0">
          {parsed.frontmatter ? (
            <KbFrontmatter data={parsed.frontmatter} />
          ) : null}
          <KbMarkdown
            content={parsed.body}
            allPaths={allPaths}
            onNavigate={onNavigate}
          />
        </div>
      )}

      <KbSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        path={path}
        saving={saveMutation.isPending}
        onConfirm={(note) => saveMutation.mutate(note)}
      />
    </div>
  );
}

function Breadcrumb({ path }: { path: string }) {
  const parts = path.split("/");
  return (
    <nav
      aria-label="Caminho"
      className="flex items-center flex-wrap gap-1 text-xs text-muted-foreground min-w-0"
    >
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1;
        return (
          <span
            key={i}
            className={cn(
              "flex items-center gap-1",
              isLast && "text-foreground font-medium",
            )}
          >
            <span className="font-mono break-all">{part}</span>
            {!isLast ? (
              <span className="text-muted-foreground/50">/</span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
