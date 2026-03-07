import { useQuery } from "@tanstack/react-query";
import { Users, Shield } from "lucide-react";
import { usersQueryOptions, type User } from "@/api/users";
import { EmptyState } from "@/components/shared/empty-state";
import { PermissionBadges } from "@/components/users/permission-badges";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export function UsersList() {
  const { data: users, isLoading } = useQuery(usersQueryOptions());

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!users?.length) {
    return (
      <EmptyState
        icon={<Users />}
        title="Nenhum usuario"
        description="Usuarios cadastrados aparecerao aqui."
      />
    );
  }

  return (
    <>
      {/* Desktop: Table */}
      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Permissoes</TableHead>
              <TableHead>Max Agentes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.slug}
                className={isSysuser(user) ? "opacity-75" : "cursor-pointer"}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {getInitials(user.displayName)}
                    </div>
                    <span className="font-medium">{user.displayName}</span>
                    {isSysuser(user) && (
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="size-3" />
                        Sistema
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-sm text-muted-foreground">{user.slug}</code>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.email || "—"}
                </TableCell>
                <TableCell>
                  <PermissionBadges permissions={user.permissions} />
                </TableCell>
                <TableCell className="text-sm">
                  {user.permissions?.maxAgents === 0
                    ? "Ilimitado"
                    : user.permissions?.maxAgents ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: Cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {users.map((user) => (
          <div
            key={user.slug}
            className={`rounded-lg border p-4 ${
              isSysuser(user)
                ? "opacity-75"
                : "cursor-pointer transition-colors hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {getInitials(user.displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.displayName}</span>
                  {isSysuser(user) && (
                    <Badge variant="secondary" className="gap-1">
                      <Shield className="size-3" />
                      Sistema
                    </Badge>
                  )}
                </div>
                <code className="text-xs text-muted-foreground">{user.slug}</code>
              </div>
            </div>

            {user.email && (
              <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
            )}

            <div className="mt-3 flex items-center justify-between gap-2">
              <PermissionBadges permissions={user.permissions} />
              <span className="text-xs text-muted-foreground">
                Max: {user.permissions?.maxAgents === 0
                  ? "Ilimitado"
                  : user.permissions?.maxAgents ?? "—"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
