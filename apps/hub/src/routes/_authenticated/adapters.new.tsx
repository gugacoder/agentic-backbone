import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared/page-header";
import { AdapterFormPage } from "@/components/adapters/adapter-form-page";
import { Button } from "@/components/ui/button";
import type { ConnectorType } from "@/components/adapters/connector-form";

interface NewAdapterSearch {
  connector?: string;
}

export const Route = createFileRoute("/_authenticated/adapters/new")({
  validateSearch: (search: Record<string, unknown>): NewAdapterSearch => ({
    connector: typeof search.connector === "string" ? search.connector : undefined,
  }),
  component: NewAdapterPage,
});

function NewAdapterPage() {
  const navigate = useNavigate();
  const { connector } = Route.useSearch();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Adaptador"
        description="Configure um novo conector de integração"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/adapters" })}
          >
            Cancelar
          </Button>
        }
      />
      <AdapterFormPage
        initialConnector={connector}
        onConnectorChange={(c) => navigate({ to: "/adapters/new", search: { connector: c } })}
        onSuccess={() => navigate({ to: "/adapters" })}
      />
    </div>
  );
}
