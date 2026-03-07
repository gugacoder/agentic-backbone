import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BreadcrumbBar } from "@/components/layout/breadcrumb-bar";
import { useSSE } from "@/hooks/use-sse";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const token = useAuthStore((s) => s.token);
  useSSE({ enabled: !!token });

  if (!token) {
    return <Navigate to="/login" />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <BreadcrumbBar />
        <div className="flex-1 overflow-auto p-4 pb-18 md:pb-4">
          <Outlet />
        </div>
      </SidebarInset>
      <BottomNav />
    </SidebarProvider>
  );
}
