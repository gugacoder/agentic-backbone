import {
  createRouter,
  createRoute,
  createRootRoute,
  RouterProvider,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { z } from "zod";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BreadcrumbBar } from "@/components/layout/breadcrumb-bar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PWAUpdatePrompt } from "@/components/shared/pwa-update-prompt";
import { Toaster } from "@/components/ui/sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthStore } from "@/lib/auth";
import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { AgentsPage } from "@/pages/agents";
import { AgentDetailPage } from "@/pages/agent-detail";
import { ChannelsPage } from "@/pages/channels";
import { MemoryPage } from "@/pages/memory";
import { UsersPage } from "@/pages/users";
import { SkillsPage } from "@/pages/skills";
import { ToolsPage } from "@/pages/tools";
import { AdaptersPage } from "@/pages/adapters";
import { AdapterDetailPage } from "@/pages/adapter-detail";
import { SystemPage } from "@/pages/system";
import { JobsPage } from "@/pages/jobs";
import { ChatPage } from "@/pages/chat";
import { NotFoundPage } from "@/pages/not-found";
import { ErrorPage } from "@/pages/error";

// Minimal root — just Outlet + Toaster (no chrome)
const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster />
    </>
  ),
});

// ── Public: /login ─────────────────────────────────────────

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
  validateSearch: (search) => loginSearchSchema.parse(search),
});

// ── Protected layout — auth gate + app chrome ──────────────

function ProtectedLayout() {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {!isMobile && <AppSidebar />}
        <main className="flex-1 flex flex-col min-w-0">
          <BreadcrumbBar />
          <div className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
            <Outlet />
          </div>
        </main>
        {isMobile && <BottomNav />}
      </div>
      <PWAUpdatePrompt />
    </SidebarProvider>
  );
}

const protectedLayoutRoute = createRoute({
  id: "protected",
  getParentRoute: () => rootRoute,
  component: ProtectedLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
  beforeLoad: ({ location }) => {
    if (!useAuthStore.getState().isAuthenticated) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }
  },
});

// ── Protected child routes ─────────────────────────────────

const indexRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/dashboard",
  component: DashboardPage,
});

const agentsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/agents",
  component: AgentsPage,
});

const agentDetailRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/agents/$agentId",
  component: AgentDetailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || "files",
    file: (search.file as string) || "SOUL.md",
  }),
});

const channelsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/channels",
  component: ChannelsPage,
});

const channelDetailRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/channels/$slug",
  component: ChannelsPage,
});

const memoryRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/memory",
  component: MemoryPage,
  validateSearch: (search: Record<string, unknown>) => ({
    agent: (search.agent as string) || "",
    tab: (search.tab as string) || "search",
    q: (search.q as string) || "",
  }),
});

const usersRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/users",
  component: UsersPage,
});

const skillsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/skills",
  component: SkillsPage,
});

const toolsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/tools",
  component: ToolsPage,
});

const adaptersRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/adapters",
  component: AdaptersPage,
});

const adapterDetailRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/adapters/$scope/$slug",
  component: AdapterDetailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || "overview",
  }),
});

const jobsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/jobs",
  component: JobsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    status: (search.status as string) || undefined,
    agent: (search.agent as string) || undefined,
  }),
});

const systemRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/system",
  component: SystemPage,
});

const chatRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/chat",
  component: ChatPage,
});

const chatAgentRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/chat/$agentId",
  component: ChatPage,
});

const chatSessionRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/chat/$agentId/$sessionId",
  component: ChatPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedLayoutRoute.addChildren([
    indexRoute,
    dashboardRoute,
    chatRoute,
    chatAgentRoute,
    chatSessionRoute,
    agentsRoute,
    agentDetailRoute,
    channelsRoute,
    channelDetailRoute,
    memoryRoute,
    usersRoute,
    skillsRoute,
    toolsRoute,
    adaptersRoute,
    adapterDetailRoute,
    jobsRoute,
    systemRoute,
  ]),
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return <RouterProvider router={router} />;
}
