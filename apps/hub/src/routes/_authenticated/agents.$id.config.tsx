import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { agentQueryOptions } from "@/api/agents";
import { AgentConfigTabs } from "@/components/agents/agent-config-tabs";

export const Route = createFileRoute("/_authenticated/agents/$id/config")({
  staticData: { title: "Configuração", description: "Parâmetros e identidade do agente" },
  validateSearch: (search: Record<string, unknown>) => ({
    subtab: typeof search.subtab === "string" ? search.subtab : undefined,
  }),
  component: AgentConfigPage,
});

function AgentConfigPage() {
  const { id } = Route.useParams();
  const { subtab } = Route.useSearch();
  const { data: agent } = useQuery(agentQueryOptions(id));
  if (!agent) return null;
  return <AgentConfigTabs agentId={id} agent={agent} subtab={subtab} />;
}
