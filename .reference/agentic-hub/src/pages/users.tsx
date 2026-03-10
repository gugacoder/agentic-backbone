import { useQuery } from "@tanstack/react-query";
import { usersQuery, useCreateUser, useDeleteUser } from "@/api/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Users, Plus, Trash2, Shield } from "lucide-react";
import { useState } from "react";

export function UsersPage() {
  const { data: users, isLoading } = useQuery(usersQuery);
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${users?.length ?? 0} user(s)`}
        actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add User</Button>}
      />

      {!users?.length ? (
        <EmptyState icon={Users} title="No users" description="No users configured." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <Card key={u.slug} className="group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{u.displayName}</CardTitle>
                  {u.slug !== "system" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setDeleteTarget(u.slug)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground font-mono">{u.slug}</p>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div className="flex items-center gap-1"><Shield className="h-3 w-3" /> Max agents: {u.permissions.maxAgents}</div>
                <div>Create agents: {u.permissions.canCreateAgents ? "Yes" : "No"}</div>
                <div>Create channels: {u.permissions.canCreateChannels ? "Yes" : "No"}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Slug (e.g., john)" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
            <Input placeholder="Display Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => { createUser.mutate({ slug: newSlug, displayName: newName }); setCreateOpen(false); setNewSlug(""); setNewName(""); }} disabled={!newSlug || !newName}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete User" description={`Delete user ${deleteTarget}?`} confirmText="Delete" variant="destructive" onConfirm={() => { if (deleteTarget) deleteUser.mutate(deleteTarget); }} />
    </div>
  );
}
