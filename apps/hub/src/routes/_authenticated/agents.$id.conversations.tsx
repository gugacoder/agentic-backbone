import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/agents/$id/conversations")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/conversations", search: { agent: params.id } });
  },
  component: () => null,
});
