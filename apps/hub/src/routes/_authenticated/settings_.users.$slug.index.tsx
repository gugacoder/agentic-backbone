import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { usersQueryOptions } from "@/api/users";
import { UserForm } from "@/components/users/user-form";

export const Route = createFileRoute("/_authenticated/settings_/users/$slug/")({
  staticData: { title: "Editar Usuario" },
  component: EditUserPage,
});

function EditUserPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data: users } = useQuery(usersQueryOptions());
  const user = users?.find((u) => u.slug === slug);

  function handleClose() {
    navigate({ to: "/settings", search: { tab: "users" } });
  }

  return (
    <UserForm
      user={user}
      open
      onOpenChange={(open) => { if (!open) handleClose(); }}
      onSuccess={handleClose}
    />
  );
}
