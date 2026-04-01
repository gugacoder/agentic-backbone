import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Users, Shield, Plus, Pencil, KeyRound } from "lucide-react";
import { usersQueryOptions, type User } from "@/api/users";
import { EmptyState } from "@/components/shared/empty-state";
import { PermissionBadges } from "@/components/users/permission-badges";
import { UserForm } from "@/components/users/user-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function isSysuser(user: User): boolean {
  return user.slug === "system";
}

function RoleBadge({ user }: { user: User }) {
  if (isSysuser(user)) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Shield className="size-3" />
        Sistema
      </Badge>
    );
  }
  if (user.role) {
    return (
      <Badge variant="outline" className="gap-1 bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20">
        <Shield className="size-3" />
        {user.role}
      </Badge>
    );
  }
  return null;
}

function UserCard({ user, onEdit }: { user: User; onEdit: () => void }) {
  const navigate = useNavigate();
  const canEdit = true;

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      {/* Linha 1: avatar + nome + slug + ações */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
          {getInitials(user.displayName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium leading-tight">{user.displayName}</span>
            <code className="text-xs text-muted-foreground">{user.slug}</code>
            <RoleBadge user={user} />
          </div>
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
              title="Editar usuario"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={() => navigate({ to: "/settings/users/$slug/password", params: { slug: user.slug } })}
              title="Trocar senha"
            >
              <KeyRound className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Linha 2: email + permissões + max agentes */}
      <div className="mt-2 ml-12 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-sm text-muted-foreground">
          {user.email || <span className="opacity-40">sem email</span>}
        </span>
        <PermissionBadges permissions={user.permissions} />
        <span className="text-xs text-muted-foreground">
          Max: {user.permissions?.maxAgents === 0 ? "ilimitado" : (user.permissions?.maxAgents ?? "—")}
        </span>
      </div>
    </div>
  );
}

export function UsersList() {
  const { data: users, isLoading } = useQuery(usersQueryOptions());
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>();

  function openCreate() {
    setEditingUser(undefined);
    setFormOpen(true);
  }

  function openEdit(user: User) {
    navigate({ to: "/settings/users/$slug", params: { slug: user.slug } });
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!users?.length) {
    return (
      <>
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 size-4" />
            Novo usuario
          </Button>
        </div>
        <EmptyState
          icon={<Users />}
          title="Nenhum usuario"
          description="Usuarios cadastrados aparecerao aqui."
        />
        <UserForm
          key="__create__"
          user={undefined}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          Novo usuario
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {users.map((user) => (
          <UserCard
            key={user.slug}
            user={user}
            onEdit={() => openEdit(user)}
          />
        ))}
      </div>

      <UserForm
        key={editingUser?.slug ?? "__create__"}
        user={editingUser}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </>
  );
}
