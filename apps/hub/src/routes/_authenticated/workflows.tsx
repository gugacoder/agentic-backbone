import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Plus, Clock, Users, CheckCircle, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workflowsQueryOptions, createWorkflow, deleteWorkflow } from "@/api/workflows";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/workflows")({
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const { data: workflows, isLoading } = useQuery(workflowsQueryOptions());

  const createMutation = useMutation({
    mutationFn: createWorkflow,
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setIsNewDialogOpen(false);
      setNewLabel("");
      navigate({ to: "/workflows/$id", params: { id: workflow.id } });
    },
    onError: () => {
      toast.error("Erro ao criar workflow");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow removido");
    },
    onError: () => {
      toast.error("Erro ao remover workflow");
    },
  });

  function handleCreate() {
    if (!newLabel.trim()) return;
    createMutation.mutate({ label: newLabel.trim() });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="Orquestracao visual de agentes com handoffs condicionais"
        actions={
          <Button onClick={() => setIsNewDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Workflow
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !workflows || workflows.length === 0 ? (
        <EmptyState
          icon={<GitBranch />}
          title="Nenhum workflow"
          description="Crie um workflow para orquestrar agentes com handoffs condicionais."
          action={
            <Button onClick={() => setIsNewDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Workflow
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => (
            <Card key={wf.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{wf.label}</CardTitle>
                  <Badge variant={wf.applied ? "default" : "secondary"}>
                    {wf.applied ? (
                      <>
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Aplicado
                      </>
                    ) : (
                      <>
                        <FileText className="mr-1 h-3 w-3" />
                        Rascunho
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  <span>{wf.nodeCount} {wf.nodeCount === 1 ? "agente" : "agentes"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Atualizado em {formatDate(wf.updatedAt)}</span>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2 pt-0">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate({ to: "/workflows/$id", params: { id: wf.id } })}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Remover "${wf.label}"?`)) {
                      deleteMutation.mutate(wf.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  Remover
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="workflow-label">Nome do workflow</Label>
              <Input
                id="workflow-label"
                placeholder="Ex: Suporte → Vendas → Escalamento"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsNewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newLabel.trim() || createMutation.isPending}
            >
              Criar e editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
