import { useCallback } from "react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Radio,
  Calendar,
  Cpu,
  Bell,
  DollarSign,
  TrendingUp,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Plug,
  Inbox,
  UserCircle,
  GitBranch,
  Star,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { pendingApprovalsQueryOptions } from "@/api/approvals";
import { securitySummaryQueryOptions } from "@/api/security";
import { inboxQueryOptions } from "@/api/inbox";
import { useSSEEvent, type SystemEvent } from "@/hooks/use-sse";
import { useAuthStore } from "@/lib/auth";

const navItemsBefore = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" as const },
] as const;

const navItemsAfter = [
  { label: "Agentes", icon: Bot, to: "/agents" as const },
  { label: "Workflows", icon: GitBranch, to: "/workflows" as const },
  { label: "Conversas", icon: MessageSquare, to: "/conversations" as const },
  { label: "Canais", icon: Radio, to: "/channels" as const },
  { label: "Agenda", icon: Calendar, to: "/cron" as const },
  { label: "Jobs", icon: Cpu, to: "/jobs" as const },
  { label: "Custos", icon: DollarSign, to: "/costs" as const },
  { label: "Analytics", icon: TrendingUp, to: "/analytics" as const },
  { label: "Ratings", icon: Star, to: "/ratings" as const },
  { label: "Notificacoes", icon: Bell, to: "/notifications" as const },
  { label: "Configuracoes", icon: Settings, to: "/settings" as const },
] as const;

export function AppSidebar() {
  const matchRoute = useMatchRoute();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAccountActive = !!matchRoute({ to: "/account" });

  const { data: pending } = useQuery(pendingApprovalsQueryOptions());
  const pendingCount = pending?.length ?? 0;

  const { data: securitySummary } = useQuery(securitySummaryQueryOptions(1));
  const hasCriticalEvents =
    (securitySummary?.bySeverity.find((s) => s.severity === "critical")?.count ?? 0) > 0;

  const { data: inboxData } = useQuery(inboxQueryOptions({ status: "waiting", limit: 1 }));
  const waitingCount = inboxData?.total ?? 0;

  useSSEEvent(
    "approval:pending",
    useCallback(
      (_event: SystemEvent) => {
        queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
      },
      [queryClient],
    ),
  );

  useSSEEvent(
    "channel:message",
    useCallback(
      (_event: SystemEvent) => {
        queryClient.invalidateQueries({ queryKey: ["inbox"] });
      },
      [queryClient],
    ),
  );

  const isInboxActive = !!matchRoute({ to: "/inbox", fuzzy: true });
  const isApprovalsActive = !!matchRoute({ to: "/approvals", fuzzy: true });
  const isAdaptersActive = !!matchRoute({ to: "/adapters", fuzzy: true });
  const isSecurityActive = !!matchRoute({ to: "/security", fuzzy: true });

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <span className="text-lg font-semibold tracking-tight">AB Hub</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItemsBefore.map((item) => {
                const isActive = !!matchRoute({ to: item.to, fuzzy: item.to !== "/" });
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton isActive={isActive} render={<Link to={item.to} />}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Inbox with waiting badge */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isInboxActive}
                  render={<Link to="/inbox" />}
                >
                  <Inbox />
                  <span className="flex-1">Inbox</span>
                  {waitingCount > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {waitingCount > 99 ? "99+" : waitingCount}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {navItemsAfter.map((item) => {
                const isActive = !!matchRoute({ to: item.to, fuzzy: true });
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton isActive={isActive} render={<Link to={item.to} />}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Approvals with badge */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isApprovalsActive}
                  render={<Link to="/approvals" />}
                >
                  <ShieldCheck />
                  <span className="flex-1">Aprovacoes</span>
                  {pendingCount > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Integracoes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isAdaptersActive}
                  render={<Link to="/adapters" />}
                >
                  <Plug />
                  <span>Adaptadores</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isSecurityActive}
                  render={<Link to="/security" />}
                >
                  <ShieldAlert />
                  <span className="flex-1">Seguranca</span>
                  {hasCriticalEvents && (
                    <span className="ml-auto inline-flex h-2 w-2 rounded-full bg-destructive" />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={isAccountActive} render={<Link to="/account" />}>
              <UserCircle />
              <span className="flex-1 truncate">{user?.displayName ?? "Minha Conta"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
