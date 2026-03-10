import { createFileRoute } from "@tanstack/react-router";
import { WebhooksTab } from "@/components/webhooks/webhooks-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/webhooks")({
  staticData: { title: "Webhooks", description: "Integrações via webhook" },
  component: AgentWebhooksPage,
});

function AgentWebhooksPage() {
  const { id } = Route.useParams();
  return <WebhooksTab agentId={id} />;
}
