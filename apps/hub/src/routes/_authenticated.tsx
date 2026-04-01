import { useCallback } from "react";
import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BreadcrumbBar } from "@/components/layout/breadcrumb-bar";
import { useSSE, useSSEEvent } from "@/hooks/use-sse";
import { PushPermissionBanner } from "@/components/notifications/push-permission-banner";
import { RouteError } from "@/components/layout/route-error";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  errorComponent: AuthenticatedError,
});

function AuthenticatedError({ error, reset }: { error: unknown; reset: () => void }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <BreadcrumbBar />
        <div className="flex-1 overflow-auto p-4 pb-18 md:pb-4">
          <RouteError error={error} reset={reset} />
        </div>
      </SidebarInset>
      <BottomNav />
    </SidebarProvider>
  );
}

function AuthenticatedLayout() {
  const token = useAuthStore((s) => s.token);
  useSSE({ enabled: !!token });

  useSSEEvent(
    "agent:quota-exceeded",
    useCallback((event) => {
      const agentId = event.data?.agentId as string | undefined;
      const agentSlug = (event.data?.agentSlug ?? event.data?.agentId) as string | undefined;
      const quota = event.data?.quota as string | undefined;
      const quotaLabel = quota === "tokens" ? "tokens/hora" : quota === "heartbeats" ? "heartbeats/dia" : quota;
      toast.warning(`Quota excedida: ${agentSlug ?? agentId}`, {
        description: `Limite de ${quotaLabel ?? "quota"} atingido. Agente pausado automaticamente.`,
        action: agentId
          ? {
              label: "Ver quotas",
              onClick: () => {
                window.location.href = `/hub/agents/${encodeURIComponent(agentId)}?tab=quotas`;
              },
            }
          : undefined,
        duration: 8000,
      });
    }, []),
  );

  if (!token) {
    return <Navigate to="/login" />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <BreadcrumbBar />
        <PushPermissionBanner />
        <div className="flex-1 overflow-auto p-4 pb-18 md:pb-4">
          <Outlet />
        </div>
      </SidebarInset>
      <BottomNav />
    </SidebarProvider>
  );
}
