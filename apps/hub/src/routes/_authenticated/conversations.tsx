import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const Route = createFileRoute("/_authenticated/conversations")({
  component: ConversationsPage,
});

function ConversationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Conversas" description="Historico de conversas com agentes" />
      <EmptyState
        icon={<MessageSquare />}
        title="Nenhuma conversa"
        description="Em breve voce podera conversar com seus agentes aqui."
      />
    </div>
  );
}
