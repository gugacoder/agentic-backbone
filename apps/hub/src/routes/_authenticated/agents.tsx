import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const Route = createFileRoute("/_authenticated/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Agentes" description="Gerencie seus agentes de IA" />
      <EmptyState
        icon={<Bot />}
        title="Nenhum agente configurado"
        description="Em breve voce podera visualizar e gerenciar seus agentes aqui."
      />
    </div>
  );
}
