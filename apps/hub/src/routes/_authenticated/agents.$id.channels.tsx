import { createFileRoute } from "@tanstack/react-router";
import { EmailChannelsTab } from "@/components/email/email-channels-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/channels")({
  staticData: { title: "Canais", description: "Canais de comunicação do agente" },
  component: AgentChannelsPage,
});

function AgentChannelsPage() {
  const { id } = Route.useParams();
  return <EmailChannelsTab agentId={id} />;
}
