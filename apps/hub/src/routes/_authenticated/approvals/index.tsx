import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApprovalCard } from "@/components/approvals/approval-card";
import { ApprovalHistory } from "@/components/approvals/approval-history";
import { pendingApprovalsQueryOptions } from "@/api/approvals";

export const Route = createFileRoute("/_authenticated/approvals/")({
  staticData: { title: "Aprovações", description: "Solicitações de aprovação críticas" },
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { data: pending, isLoading } = useQuery(pendingApprovalsQueryOptions());

  const pendingList = pending ?? [];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pendentes
            {pendingList.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {pendingList.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Historico</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : pendingList.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck />}
              title="Nenhuma aprovacao pendente"
              description="Quando um agente solicitar aprovacao para uma acao critica, ela aparecera aqui."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingList.map((approval) => (
                <ApprovalCard key={approval.id} approval={approval} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <ApprovalHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
