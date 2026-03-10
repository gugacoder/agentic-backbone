import { createFileRoute } from "@tanstack/react-router";
import { BenchmarkTab } from "@/components/agents/benchmark-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/benchmarks")({
  staticData: { title: "Benchmarks", description: "Resultados de benchmark do agente" },
  component: AgentBenchmarksPage,
});

function AgentBenchmarksPage() {
  const { id } = Route.useParams();
  return <BenchmarkTab agentId={id} />;
}
