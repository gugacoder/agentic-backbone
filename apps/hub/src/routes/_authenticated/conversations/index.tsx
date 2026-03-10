import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export const Route = createFileRoute("/_authenticated/conversations/")({
  staticData: { title: "Conversas", description: "Histórico de conversas com agentes" },
  component: ConversationsIndex,
});

function ConversationsIndex() {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={<MessageSquare />}
        title="Selecione uma conversa"
        description="Escolha uma conversa na lista ou inicie uma nova."
      />
    </div>
  );
}
