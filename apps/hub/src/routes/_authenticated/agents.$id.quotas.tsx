import { createFileRoute } from "@tanstack/react-router";
import { QuotasTab } from "@/components/quotas/quotas-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/quotas")({
  staticData: { title: "Quotas", description: "Limites de uso do agente" },
  component: AgentQuotasPage,
});

function AgentQuotasPage() {
  const { id } = Route.useParams();
  return <QuotasTab agentId={id} />;
}
