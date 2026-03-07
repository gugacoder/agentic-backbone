import { createFileRoute } from "@tanstack/react-router";
import { AgentForm } from "@/components/agents/agent-form";
import { PageHeader } from "@/components/shared/page-header";

export const Route = createFileRoute("/_authenticated/agents/new")({
  component: NewAgentPage,
});

function NewAgentPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Agente"
        description="Preencha os dados para criar um novo agente"
      />
      <AgentForm />
    </div>
  );
}
