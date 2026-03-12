import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/api/users";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/settings_/users/$slug/password",
)({
  staticData: { title: "Trocar Senha" },
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [backendError, setBackendError] = useState<string | null>(null);

  function handleClose() {
    navigate({ to: "/settings", search: { tab: "users" } });
  }

  const mutation = useMutation({
    mutationFn: () => changePassword(slug, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Senha alterada com sucesso");
      handleClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const body = error.body as Record<string, unknown> | undefined;
        setBackendError((body?.error as string) ?? "Erro ao alterar senha");
      } else {
        setBackendError("Erro ao alterar senha");
      }
    },
  });

  function validate(): boolean {
    const errs: { password?: string; confirm?: string } = {};
    if (!password) {
      errs.password = "Senha e obrigatoria";
    } else if (password.length < 6) {
      errs.password = "Senha deve ter no minimo 6 caracteres";
    }
    if (password !== confirm) {
      errs.confirm = "Senhas nao conferem";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBackendError(null);
    if (!validate()) return;
    mutation.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            Trocar Senha
          </DialogTitle>
          <DialogDescription>
            Definir nova senha para <code className="text-xs">{slug}</code>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Minimo 6 caracteres"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((p) => ({ ...p, password: undefined }));
                setBackendError(null);
              }}
              aria-invalid={!!errors.password}
              autoFocus
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar senha</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Repita a senha"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setErrors((p) => ({ ...p, confirm: undefined }));
              }}
              aria-invalid={!!errors.confirm}
            />
            {errors.confirm && (
              <p className="text-sm text-destructive">{errors.confirm}</p>
            )}
          </div>

          {backendError && (
            <p className="text-sm text-destructive">{backendError}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar senha"}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
