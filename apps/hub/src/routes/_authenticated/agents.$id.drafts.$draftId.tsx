import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Save, MessageSquare, Rocket } from "lucide-react";
import { draftQueryOptions, updateDraft, publishDraft } from "@/api/drafts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DraftChatPanel } from "@/components/sandbox/draft-chat-panel";

export const Route = createFileRoute("/_authenticated/agents/$id/drafts/$draftId")({
  component: DraftEditorPage,
});

function DraftEditorPage() {
  const { id: agentId, draftId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: draft, isLoading } = useQuery(draftQueryOptions(agentId, draftId));

  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Initialize local state when data arrives
  const files = draft?.files ?? {};
  const fileKeys = Object.keys(files);

  function getContent(fileName: string) {
    return fileName in fileContents ? fileContents[fileName]! : (files[fileName] ?? "");
  }

  const currentFile = activeFile ?? fileKeys[0] ?? null;

  async function handleSave() {
    if (!currentFile) return;
    setSaving(true);
    try {
      await updateDraft(agentId, draftId, {
        fileName: currentFile,
        content: getContent(currentFile),
      });
      queryClient.invalidateQueries({ queryKey: ["drafts", agentId, draftId] });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      await publishDraft(agentId, draftId);
      queryClient.invalidateQueries({ queryKey: ["drafts", agentId] });
      setShowPublish(false);
    } finally {
      setPublishing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground">Rascunho nao encontrado.</p>
        <Link
          to="/agents/$id"
          params={{ id: agentId }}
          search={{ tab: "sandbox" }}
          className="text-sm text-primary underline"
        >
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0">
      <div className={`flex flex-col flex-1 space-y-4 min-w-0 ${showChat ? "pr-4" : ""}`}>
        {/* Breadcrumb */}
        <div className="space-y-1">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link to="/agents" className="hover:text-foreground transition-colors">
              Agentes
            </Link>
            <ChevronRight className="size-3.5" />
            <Link
              to="/agents/$id"
              params={{ id: agentId }}
              search={{ tab: "sandbox" }}
              className="hover:text-foreground transition-colors"
            >
              {agentId}
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-medium">{draft.label}</span>
          </nav>

          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{draft.label}</h1>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowChat(!showChat)}>
                <MessageSquare className="size-4 mr-1" />
                Testar no chat
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowPublish(true)}>
                <Rocket className="size-4 mr-1" />
                Publicar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !currentFile}>
                <Save className="size-4 mr-1" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>

        {fileKeys.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum arquivo encontrado no rascunho.</p>
        )}

        {fileKeys.length > 0 && (
          <Tabs
            value={currentFile ?? fileKeys[0]}
            onValueChange={(v) => setActiveFile(v)}
            className="flex-1 flex flex-col"
          >
            <TabsList>
              {fileKeys.map((f) => (
                <TabsTrigger key={f} value={f}>
                  {f}
                </TabsTrigger>
              ))}
            </TabsList>

            {fileKeys.map((f) => (
              <TabsContent key={f} value={f} className="flex-1 mt-2">
                <textarea
                  className="w-full h-full min-h-[400px] font-mono text-sm p-3 border rounded-md bg-muted/20 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  value={getContent(f)}
                  onChange={(e) =>
                    setFileContents((prev) => ({ ...prev, [f]: e.target.value }))
                  }
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* Chat panel */}
      {showChat && (
        <div className="w-96 flex-shrink-0">
          <DraftChatPanel
            agentId={agentId}
            draftId={draftId}
            onClose={() => setShowChat(false)}
          />
        </div>
      )}

      {/* Publish dialog */}
      <Dialog open={showPublish} onOpenChange={setShowPublish}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar rascunho</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isso sobrescreve a producao com o rascunho{" "}
            <strong>{draft.label}</strong>. O estado atual sera salvo como nova
            versao antes de ser substituido.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublish(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? "Publicando..." : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
