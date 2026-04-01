import { createFileRoute, Outlet } from "@tanstack/react-router";
import { agentQueryOptions } from "@/api/agents";
import { queryClient } from "@/lib/query-client";
import { RouteError } from "@/components/layout/route-error";

export const Route = createFileRoute("/_authenticated/agents/$id")({
  loader: async ({ params }) => {
    const agent = await queryClient.ensureQueryData(agentQueryOptions(params.id));
    return { title: agent.slug, description: "Agente" };
  },
  errorComponent: RouteError,
  component: AgentLayout,
});

function AgentLayout() {
  return <Outlet />;
}
