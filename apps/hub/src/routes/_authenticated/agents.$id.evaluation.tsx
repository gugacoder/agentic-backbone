import { createFileRoute } from "@tanstack/react-router";
import { EvalTab } from "@/components/agents/eval-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/evaluation")({
  staticData: { title: "Avaliação", description: "Testes e avaliações do agente" },
  component: AgentEvaluationPage,
});

function AgentEvaluationPage() {
  const { id } = Route.useParams();
  return <EvalTab agentId={id} />;
}
