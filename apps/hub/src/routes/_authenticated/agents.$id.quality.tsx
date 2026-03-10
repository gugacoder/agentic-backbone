import { createFileRoute } from "@tanstack/react-router";
import { QualityTab } from "@/components/quality/quality-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/quality")({
  staticData: { title: "Qualidade", description: "Indicadores de qualidade do agente" },
  validateSearch: (search: Record<string, unknown>) => ({
    days: typeof search.days === "number" && [7, 30, 90].includes(search.days as number)
      ? (search.days as number)
      : undefined,
  }),
  component: AgentQualityPage,
});

function AgentQualityPage() {
  const { id } = Route.useParams();
  const { days } = Route.useSearch();
  return <QualityTab agentId={id} days={days ?? 30} />;
}
