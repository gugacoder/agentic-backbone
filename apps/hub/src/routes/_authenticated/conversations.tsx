import { createFileRoute } from "@tanstack/react-router";
import { ConversationsLayout } from "@/components/conversations/conversations-layout";

export const Route = createFileRoute("/_authenticated/conversations")({
  staticData: { title: "Conversas", description: "Histórico de conversas com agentes" },
  component: ConversationsPage,
});

function ConversationsPage() {
  return <ConversationsLayout basePath="/conversations" />;
}
