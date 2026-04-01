import { createRootRoute, Outlet } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/query-client";
import { RouteError } from "@/components/layout/route-error";

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RouteError,
});

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
