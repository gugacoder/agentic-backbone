import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { TemplateGallery } from "@/components/agents/template-gallery";
import { AgentForm } from "@/components/agents/agent-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { agentTemplatesQueryOptions } from "@/api/templates";

interface NewAgentSearch {
  template?: string;
}

export const Route = createFileRoute("/_authenticated/agents/new")({
  validateSearch: (search: Record<string, unknown>): NewAgentSearch => ({
    template: typeof search.template === "string" ? search.template : undefined,
  }),
  component: NewAgentPage,
});

function NewAgentPage() {
  const navigate = useNavigate();
  const { template } = Route.useSearch();

  const { data, isLoading } = useQuery(agentTemplatesQueryOptions());
  const templates = data?.templates ?? [];

  const handleSelectTemplate = (slug: string) => {
    navigate({ to: "/agents/new", search: { template: slug } });
  };

  const handleScratch = () => {
    navigate({ to: "/agents/new", search: { template: "scratch" } });
  };

  if (template === "scratch") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Criar agente do zero"
          description="Preencha os dados para criar um novo agente"
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/agents/new", search: {} })}
            >
              Voltar para galeria
            </Button>
          }
        />
        <AgentForm />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo agente"
        description="Escolha um template para comecar rapidamente ou crie do zero"
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : (
        <TemplateGallery templates={templates} onSelect={handleSelectTemplate} />
      )}

      <Separator />

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Prefere comecar do zero?</p>
          <p className="text-sm text-muted-foreground">
            Configure seu agente manualmente sem usar um template.
          </p>
        </div>
        <Button variant="outline" onClick={handleScratch}>
          <FilePlus2 className="mr-2 size-4" />
          Criar do zero
        </Button>
      </div>
    </div>
  );
}
