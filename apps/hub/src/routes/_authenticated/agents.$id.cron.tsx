import { createFileRoute } from "@tanstack/react-router";
import { AgentCronTab } from "@/components/agents/agent-cron-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/cron")({
  staticData: { title: "Agenda", description: "Tarefas agendadas do agente" },
  component: AgentCronPage,
});

function AgentCronPage() {
  const { id } = Route.useParams();
  return <AgentCronTab agentId={id} />;
}
