import { createFileRoute } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const Route = createFileRoute("/_authenticated/channels")({
  component: ChannelsPage,
});

function ChannelsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Canais" description="Canais de comunicacao dos agentes" />
      <EmptyState
        icon={<Radio />}
        title="Nenhum canal configurado"
        description="Em breve voce podera gerenciar canais de comunicacao aqui."
      />
    </div>
  );
}
