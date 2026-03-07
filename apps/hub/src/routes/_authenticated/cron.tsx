import { createFileRoute } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const Route = createFileRoute("/_authenticated/cron")({
  component: CronPage,
});

function CronPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Agenda" description="Tarefas agendadas dos agentes" />
      <EmptyState
        icon={<Calendar />}
        title="Nenhum agendamento"
        description="Em breve voce podera configurar tarefas agendadas aqui."
      />
    </div>
  );
}
