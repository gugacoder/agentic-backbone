import { createFileRoute } from "@tanstack/react-router";
import { SandboxTab } from "@/components/sandbox/sandbox-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/sandbox")({
  staticData: { title: "Sandbox", description: "Ambiente de testes do agente" },
  component: AgentSandboxPage,
});

function AgentSandboxPage() {
  const { id } = Route.useParams();
  return <SandboxTab agentId={id} />;
}
