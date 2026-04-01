import { createFileRoute } from "@tanstack/react-router";
import { RoutingAnalyticsTab } from "@/components/routing/routing-analytics-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/routing")({
  staticData: { title: "Routing", description: "Analytics de roteamento de mensagens" },
  component: AgentRoutingPage,
});

function AgentRoutingPage() {
  const { id } = Route.useParams();
  return <RoutingAnalyticsTab agentId={id} />;
}
