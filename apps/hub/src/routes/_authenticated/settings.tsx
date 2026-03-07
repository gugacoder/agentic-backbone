import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Configuracoes" description="Configuracoes do sistema" />
      <EmptyState
        icon={<Settings />}
        title="Em breve"
        description="As configuracoes do sistema estarao disponiveis aqui."
      />
    </div>
  );
}
