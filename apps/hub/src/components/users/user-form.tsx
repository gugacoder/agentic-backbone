import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  createUser,
  updateUser,
  deleteUser,
  userAgentsQueryOptions,
  type User,
} from "@/api/users";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

interface UserFormProps {
  user?: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UserForm({
  user,
  open,
  onOpenChange,
  onSuccess,
}: UserFormProps) {
  const isEditing = !!user;
  const queryClient = useQueryClient();

  const [slug, setSlug] = useState(user?.slug ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? "");
  const [role, setRole] = useState(user?.role ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [canCreateAgents, setCanCreateAgents] = useState(
    user?.permissions?.canCreateAgents ?? true,
  );
  const [canCreateChannels, setCanCreateChannels] = useState(
    user?.permissions?.canCreateChannels ?? false,
  );
  const [maxAgents, setMaxAgents] = useState(
    String(user?.permissions?.maxAgents ?? 0),
  );

  const [street, setStreet] = useState(user?.address?.street ?? "");
  const [neighborhood, setNeighborhood] = useState(user?.address?.neighborhood ?? "");
  const [city, setCity] = useState(user?.address?.city ?? "");
  const [state, setState] = useState(user?.address?.state ?? "");
  const [country, setCountry] = useState(user?.address?.country ?? "");
  const [postalCode, setPostalCode] = useState(user?.address?.postalCode ?? "");
  const [timezone, setTimezone] = useState(user?.address?.timezone ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [backendError, setBackendError] = useState<string | null>(null);

  function resetForm() {
    if (!user) {
      setSlug("");
      setDisplayName("");
      setEmail("");
      setPhoneNumber("");
      setRole("");
      setPassword("");
      setConfirmPassword("");
      setCanCreateAgents(true);
      setCanCreateChannels(false);
      setMaxAgents("0");
      setStreet("");
      setNeighborhood("");
      setCity("");
      setState("");
      setCountry("");
      setPostalCode("");
      setTimezone("");
    }
    setErrors({});
    setBackendError(null);
  }

  function handleOpenChange(open: boolean) {
    if (!open) resetForm();
    onOpenChange(open);
  }

  const handleSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    toast.success(
      isEditing ? "Usuario atualizado com sucesso" : "Usuario criado com sucesso",
    );
    handleOpenChange(false);
    onSuccess?.();
  }, [queryClient, isEditing, onSuccess]);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof ApiError) {
      const body = error.body as Record<string, unknown> | undefined;
      const msg =
        (body?.error as string) ??
        (body?.message as string) ??
        "Erro ao salvar usuario";
      setBackendError(msg);
    } else {
      setBackendError("Erro ao salvar usuario");
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateUser>[1]) =>
      updateUser(user!.slug, payload),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(user!.slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuario excluido com sucesso");
      handleOpenChange(false);
      onSuccess?.();
    },
    onError: handleError,
  });

  const agentsQuery = useQuery({
    ...userAgentsQueryOptions(user?.slug ?? ""),
    enabled: isEditing && !!user?.slug,
  });
  const agentCount = agentsQuery.data?.length ?? 0;

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const isSystemUser = user?.slug === "system";

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!isEditing) {
      const trimmedSlug = slug.trim();
      if (!trimmedSlug) {
        errs.slug = "Slug e obrigatorio";
      } else if (trimmedSlug.length < 3 || trimmedSlug.length > 30) {
        errs.slug = "Slug deve ter entre 3 e 30 caracteres";
      } else if (!KEBAB_CASE_RE.test(trimmedSlug)) {
        errs.slug = "Slug deve ser kebab-case (ex: joao-silva)";
      }
    }

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      errs.displayName = "Nome e obrigatorio";
    } else if (trimmedName.length < 2 || trimmedName.length > 100) {
      errs.displayName = "Nome deve ter entre 2 e 100 caracteres";
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Formato de email invalido";
    }

    if (!isEditing) {
      if (!password) {
        errs.password = "Senha e obrigatoria";
      } else if (password.length < 6) {
        errs.password = "Senha deve ter no minimo 6 caracteres";
      }
      if (password !== confirmPassword) {
        errs.confirmPassword = "Senhas nao conferem";
      }
    }

    const maxNum = Number(maxAgents);
    if (maxAgents.trim() !== "" && (isNaN(maxNum) || maxNum < 0 || !Number.isInteger(maxNum))) {
      errs.maxAgents = "Deve ser um numero inteiro >= 0";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBackendError(null);

    if (!validate()) return;

    const permissions = {
      canCreateAgents,
      canCreateChannels,
      maxAgents: Number(maxAgents) || 0,
    };

    const address = {
      street: street.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      country: country.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      timezone: timezone.trim() || undefined,
    };
    const hasAddress = Object.values(address).some(Boolean);

    if (isEditing) {
      updateMutation.mutate({
        displayName: displayName.trim(),
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        role: role.trim() || null,
        permissions,
        address: hasAddress ? address : undefined,
      });
    } else {
      createMutation.mutate({
        slug: slug.trim(),
        displayName: displayName.trim(),
        password,
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        permissions,
        address: hasAddress ? address : undefined,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Usuario" : "Novo Usuario"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere os dados do usuario."
              : "Preencha os dados para criar um novo usuario."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(100vh-12rem)]">
          <form onSubmit={handleSubmit} className="space-y-5 pr-2">
            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="user-slug">Slug</Label>
              <Input
                id="user-slug"
                placeholder="joao-silva"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setErrors((prev) => ({ ...prev, slug: undefined! }));
                  setBackendError(null);
                }}
                disabled={isEditing}
                aria-invalid={!!errors.slug}
              />
              {isEditing && (
                <p className="text-xs text-muted-foreground">
                  O slug nao pode ser alterado apos a criacao.
                </p>
              )}
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug}</p>
              )}
            </div>

            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="user-name">Nome</Label>
              <Input
                id="user-name"
                placeholder="Joao da Silva"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setErrors((prev) => ({ ...prev, displayName: undefined! }));
                }}
                aria-invalid={!!errors.displayName}
              />
              {errors.displayName && (
                <p className="text-sm text-destructive">{errors.displayName}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                placeholder="joao@exemplo.com (opcional)"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: undefined! }));
                }}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Telefone */}
            <div className="space-y-2">
              <Label htmlFor="user-phone">Telefone</Label>
              <Input
                id="user-phone"
                type="tel"
                placeholder="5532984110531 (opcional)"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            {/* Role — apenas em edição */}
            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="user-role">Papel (role)</Label>
                <Input
                  id="user-role"
                  placeholder="sysadmin (deixe vazio para usuario comum)"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use "sysadmin" para conceder acesso de administrador.
                </p>
              </div>
            )}

            {/* Senha — apenas na criação */}
            {!isEditing && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user-password">Senha</Label>
                  <Input
                    id="user-password"
                    type="password"
                    placeholder="Minimo 6 caracteres"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((prev) => ({
                        ...prev,
                        password: undefined!,
                        confirmPassword: undefined!,
                      }));
                    }}
                    aria-invalid={!!errors.password}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-confirm-password">Confirmar Senha</Label>
                  <Input
                    id="user-confirm-password"
                    type="password"
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrors((prev) => ({ ...prev, confirmPassword: undefined! }));
                    }}
                    aria-invalid={!!errors.confirmPassword}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Endereco */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-medium">Endereco</legend>

              <div className="space-y-2">
                <Label htmlFor="user-street">Rua</Label>
                <Input
                  id="user-street"
                  placeholder="Rua Exemplo, 123"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-neighborhood">Bairro</Label>
                <Input
                  id="user-neighborhood"
                  placeholder="Centro"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="user-city">Cidade</Label>
                  <Input
                    id="user-city"
                    placeholder="Juiz de Fora"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-state">Estado</Label>
                  <Input
                    id="user-state"
                    placeholder="MG"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="user-country">Pais</Label>
                  <Input
                    id="user-country"
                    placeholder="Brasil"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-postalcode">CEP</Label>
                  <Input
                    id="user-postalcode"
                    placeholder="36010-000"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-timezone">Timezone</Label>
                <Input
                  id="user-timezone"
                  placeholder="America/Sao_Paulo"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>
            </fieldset>

            {/* Permissoes */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-medium">Permissoes</legend>

              <div className="flex items-center gap-3">
                <Switch
                  id="user-create-agents"
                  checked={canCreateAgents}
                  onCheckedChange={setCanCreateAgents}
                />
                <Label htmlFor="user-create-agents">Criar agentes</Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="user-create-channels"
                  checked={canCreateChannels}
                  onCheckedChange={setCanCreateChannels}
                />
                <Label htmlFor="user-create-channels">Criar canais</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-max-agents">
                  Max agentes (0 = ilimitado)
                </Label>
                <Input
                  id="user-max-agents"
                  type="number"
                  min={0}
                  value={maxAgents}
                  onChange={(e) => {
                    setMaxAgents(e.target.value);
                    setErrors((prev) => ({ ...prev, maxAgents: undefined! }));
                  }}
                  className="w-32"
                  aria-invalid={!!errors.maxAgents}
                />
                {errors.maxAgents && (
                  <p className="text-sm text-destructive">{errors.maxAgents}</p>
                )}
              </div>
            </fieldset>

            {backendError && (
              <p className="text-sm text-destructive">{backendError}</p>
            )}

            {isEditing && agentCount > 0 && (
              <p className="text-sm text-muted-foreground">
                Este usuario possui {agentCount} agente{agentCount !== 1 ? "s" : ""}.
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? isEditing
                    ? "Salvando..."
                    : "Criando..."
                  : isEditing
                    ? "Salvar"
                    : "Criar Usuario"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>

              {isEditing && !isSystemUser && (
                <div className="ml-auto">
                  <ConfirmDialog
                    title="Excluir usuario"
                    description={`Tem certeza que deseja excluir o usuario ${user!.slug}?${agentCount > 0 ? ` Este usuario possui ${agentCount} agente${agentCount !== 1 ? "s" : ""}.` : ""}`}
                    onConfirm={() => deleteMutation.mutate()}
                    destructive
                  >
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isPending}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Excluir
                    </Button>
                  </ConfirmDialog>
                </div>
              )}
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
