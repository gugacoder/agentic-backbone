/**
 * Notif Gateway Admin page para o Hub.
 * Usa /api/v2/admin/notif/* via proxy para cia-api.
 * Token do hub (backbone JWT) é aceito pelo jwtVerify de cia-api.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Shield,
  Plus,
  Trash2,
  Pencil,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuthStore } from "@/lib/auth";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotifSource {
  id: string;
  source_key: string;
  list_id: string | null;
  list_name: string | null;
  status: "disabled" | "interceptado" | "default";
  first_seen: string;
}

interface NotifList {
  id: string;
  name: string;
  slug: string;
  type: "default" | "interceptado";
  is_default: boolean;
  member_count?: number;
  source_count?: number;
}

interface NotifMode {
  id: number;
  is_active: boolean;
}

// ─── API client (cia-api, /api/v2/admin/notif/*) ─────────────────────────────

async function notifRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api/v2/admin/notif${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

const notifApi = {
  getMode: () => notifRequest<NotifMode>("/mode"),
  activateMode: () => notifRequest<{ success: boolean }>("/mode/activate", { method: "POST" }),
  deactivateMode: () => notifRequest<{ success: boolean }>("/mode/deactivate", { method: "POST" }),
  getSources: () => notifRequest<NotifSource[]>("/sources"),
  updateSourceList: (key: string, list_id: string | null) =>
    notifRequest<{ success: boolean }>(`/sources/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify({ list_id }),
    }),
  getLists: () => notifRequest<NotifList[]>("/lists"),
  createList: (data: { name: string; slug: string; type: string }) =>
    notifRequest<NotifList>("/lists", { method: "POST", body: JSON.stringify(data) }),
  updateList: (id: string, data: { name?: string; type?: string }) =>
    notifRequest<NotifList>(`/lists/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteList: (id: string) =>
    notifRequest<{ success: boolean }>(`/lists/${id}`, { method: "DELETE" }),
};

// ─── Zone 1: Modo Banner ──────────────────────────────────────────────────────

function ModeBanner({ onChanged }: { onChanged: () => void }) {
  const { data: mode, isLoading } = useQuery({
    queryKey: ["notif-mode"],
    queryFn: () => notifApi.getMode(),
  });
  const [busy, setBusy] = useState(false);

  async function handleActivate() {
    setBusy(true);
    try {
      await notifApi.activateMode();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate() {
    setBusy(true);
    try {
      await notifApi.deactivateMode();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando modo...
        </CardContent>
      </Card>
    );
  }

  const isActive = mode?.is_active ?? false;

  return (
    <Card className={cn(isActive ? "border-amber-500/60 bg-amber-500/5" : "")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={cn("p-2.5 rounded-full shrink-0", isActive ? "bg-amber-500/20" : "bg-muted")}>
            {isActive ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <Shield className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium">Modo Interceptação</p>
              <Badge
                variant={isActive ? "default" : "secondary"}
                className={isActive ? "bg-amber-500 text-white border-amber-500" : ""}
              >
                {isActive ? "ATIVO" : "Inativo"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isActive
                ? "Todas as notificações estão sendo redirecionadas para interceptadores."
                : "Notificações seguem as regras normais de lista por source."}
            </p>
          </div>
          <div className="shrink-0">
            {isActive ? (
              <Button variant="outline" size="sm" onClick={handleDeactivate} disabled={busy}>
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Restaurar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleActivate}
                disabled={busy}
                className="border-amber-500/50 hover:bg-amber-500/10 text-amber-600 hover:text-amber-700"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Ativar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Zone 2: Sources ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<NotifSource["status"], string> = {
  disabled: "Desativado",
  default: "Padrão",
  interceptado: "Interceptado",
};

function SourcesTable({ lists }: { lists: NotifList[] }) {
  const queryClient = useQueryClient();
  const { data: sources, isLoading } = useQuery({
    queryKey: ["notif-sources"],
    queryFn: () => notifApi.getSources(),
  });

  async function handleAssignList(key: string, listId: string | null) {
    await notifApi.updateSourceList(key, listId);
    queryClient.invalidateQueries({ queryKey: ["notif-sources"] });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Sources{sources ? ` (${sources.length})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando sources...
          </div>
        ) : !sources?.length ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhuma source registrada. Sources aparecem automaticamente ao enviar a primeira notificação.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lista</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-mono text-sm">{source.source_key}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        source.status === "disabled"
                          ? "secondary"
                          : source.status === "interceptado"
                          ? "default"
                          : "outline"
                      }
                    >
                      {STATUS_LABEL[source.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={source.list_id ?? "__none__"}
                      onValueChange={(val) =>
                        handleAssignList(source.source_key, val === "__none__" ? null : val)
                      }
                    >
                      <SelectTrigger className="w-44 h-8 text-sm">
                        <SelectValue placeholder="Sem lista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem lista</SelectItem>
                        {lists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Zone 3: Listas ──────────────────────────────────────────────────────────

type CreateForm = { name: string; slug: string; type: "default" | "interceptado" };
type EditForm = { name: string; type: "default" | "interceptado" };

function ListsPanel() {
  const queryClient = useQueryClient();
  const { data: lists, isLoading } = useQuery({
    queryKey: ["notif-lists"],
    queryFn: () => notifApi.getLists(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<NotifList | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NotifList | null>(null);

  const [createForm, setCreateForm] = useState<CreateForm>({ name: "", slug: "", type: "default" });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", type: "default" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  async function handleCreate() {
    setBusy(true);
    setFormError("");
    try {
      await notifApi.createList(createForm);
      queryClient.invalidateQueries({ queryKey: ["notif-lists"] });
      setCreateOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro ao criar lista");
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit() {
    if (!editTarget) return;
    setBusy(true);
    setFormError("");
    try {
      await notifApi.updateList(editTarget.id, editForm);
      queryClient.invalidateQueries({ queryKey: ["notif-lists"] });
      setEditTarget(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro ao editar lista");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    await notifApi.deleteList(id);
    queryClient.invalidateQueries({ queryKey: ["notif-lists"] });
    queryClient.invalidateQueries({ queryKey: ["notif-sources"] });
    setDeleteTarget(null);
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Listas</CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setCreateForm({ name: "", slug: "", type: "default" });
                setFormError("");
                setCreateOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nova Lista
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando listas...
            </div>
          ) : !lists?.length ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma lista encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Membros</TableHead>
                  <TableHead className="text-center">Sources</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((list) => (
                  <TableRow key={list.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{list.name}</span>
                        {list.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            Padrão
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={list.type === "interceptado" ? "default" : "outline"}>
                        {list.type === "interceptado" ? "Interceptado" : "Padrão"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {list.member_count ?? 0}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {list.source_count ?? 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditForm({ name: list.name, type: list.type });
                            setFormError("");
                            setEditTarget(list);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {!list.is_default && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(list)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Lista</DialogTitle>
            <DialogDescription>
              Crie uma lista de controle para agrupar contatos por regra de entrega.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                placeholder="Ex: Supervisores"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                placeholder="Ex: supervisores"
                value={createForm.slug}
                onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={createForm.type}
                onValueChange={(val) =>
                  setCreateForm((f) => ({ ...f, type: val as "default" | "interceptado" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão</SelectItem>
                  <SelectItem value="interceptado">Interceptado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={busy || !createForm.name.trim() || !createForm.slug.trim()}
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            {!editTarget?.is_default && (
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={editForm.type}
                  onValueChange={(val) =>
                    setEditForm((f) => ({ ...f, type: val as "default" | "interceptado" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Padrão</SelectItem>
                    <SelectItem value="interceptado">Interceptado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={busy || !editForm.name.trim()}>
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir lista?"
        description={
          (deleteTarget?.source_count ?? 0) > 0
            ? `Esta lista tem ${deleteTarget?.source_count} source(s) associada(s). Elas ficarão sem lista após a exclusão.`
            : "Esta ação não pode ser desfeita."
        }
        confirmText="Excluir"
        variant="destructive"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
      />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function NotifGatewayPage() {
  const queryClient = useQueryClient();
  const { data: lists } = useQuery({
    queryKey: ["notif-lists"],
    queryFn: () => notifApi.getLists(),
  });

  function handleModeChanged() {
    queryClient.invalidateQueries({ queryKey: ["notif-mode"] });
    queryClient.invalidateQueries({ queryKey: ["notif-sources"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Notificações"
        description="Gerencie listas de controle, sources e o modo de interceptação global."
      />

      {/* Zone 1 */}
      <ModeBanner onChanged={handleModeChanged} />

      {/* Zone 2 */}
      <SourcesTable lists={lists ?? []} />

      {/* Zone 3 */}
      <ListsPanel />
    </div>
  );
}
