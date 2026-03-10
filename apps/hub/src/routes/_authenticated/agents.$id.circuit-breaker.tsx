import { createFileRoute } from "@tanstack/react-router";
import { CircuitBreakerTab } from "@/components/agents/circuit-breaker-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/circuit-breaker")({
  staticData: { title: "Circuit Breaker", description: "Proteção contra falhas em cascata" },
  component: AgentCircuitBreakerPage,
});

function AgentCircuitBreakerPage() {
  const { id } = Route.useParams();
  return <CircuitBreakerTab agentId={id} />;
}
