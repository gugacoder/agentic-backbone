import { useCallback } from "react";
import { Link, useMatchRoute, useParams, useSearch } from "@tanstack/react-router";
import { AgentNavMenu } from "@/components/layout/context-menu";
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
  ClipboardCheck,
  Plug,
  Inbox,
  GitBranch,
  Star,
  Network,
  Telescope,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { pendingApprovalsQueryOptions } from "@/api/approvals";
import { securitySummaryQueryOptions } from "@/api/security";
import { inboxQueryOptions } from "@/api/inbox";
import { useSSEEvent, type SystemEvent } from "@/hooks/use-sse";
import { useAuthStore } from "@/lib/auth";

const navItemsCore = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" as const },
  { label: "Agentes", icon: Bot, to: "/agents" as const },
  { label: "Workflows", icon: GitBranch, to: "/workflows" as const },
  { label: "Conversas", icon: MessageSquare, to: "/conversations" as const },
  { label: "Canais", icon: Radio, to: "/channels" as const },
] as const;

const navItemsOps = [
  { label: "Agenda", icon: Calendar, to: "/cron" as const },
  { label: "Jobs", icon: Cpu, to: "/jobs" as const },
] as const;

const navItemsAnalytics = [
  { label: "Analytics", icon: TrendingUp, to: "/analytics" as const },
  { label: "Ratings", icon: Star, to: "/ratings" as const },
  { label: "Custos", icon: DollarSign, to: "/costs" as const },
  { label: "Notificações", icon: Bell, to: "/notifications" as const },
] as const;

interface NavMenuProps {
  onNavigate?: () => void;
}

function NavItem({
  to,
  icon: Icon,
  label,
  isActive,
  badge,
  dot,
  onNavigate,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  badge?: number;
  dot?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {dot && <span className="size-2 rounded-full bg-destructive" />}
    </Link>
  );
}

export function NavMenu({ onNavigate }: NavMenuProps) {
  const matchRoute = useMatchRoute();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const isAgentDetail = !!matchRoute({ to: "/agents/$id", fuzzy: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeParams = useParams({ strict: false }) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeSearch = useSearch({ strict: false }) as any;

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
  const isComplianceActive = !!matchRoute({ to: "/compliance", fuzzy: true });
  const isFleetActive = !!matchRoute({ to: "/fleet", fuzzy: true });
  const isOtelActive = !!matchRoute({ to: "/settings/otel", fuzzy: true });
  const isSettingsActive = !!matchRoute({ to: "/settings", fuzzy: true }) && !isOtelActive;
  if (isAgentDetail && routeParams?.id) {
    return (
      <div className="flex flex-col gap-1 px-2">
        <AgentNavMenu
          agentId={routeParams.id}
          activeSection=""
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-2">
      {/* Grupo principal */}
      <div className="flex flex-col gap-0.5">
        {navItemsCore.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            isActive={!!matchRoute({ to: item.to, fuzzy: item.to !== "/" })}
            onNavigate={onNavigate}
          />
        ))}
        <NavItem
          to="/inbox"
          icon={Inbox}
          label="Inbox"
          isActive={isInboxActive}
          badge={waitingCount}
          onNavigate={onNavigate}
        />
      </div>

      {/* Grupo Operações */}
      <div className="mt-2 flex flex-col gap-0.5">
        <span className="px-3 py-1 text-xs font-medium text-muted-foreground">Operações</span>
        {navItemsOps.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            isActive={!!matchRoute({ to: item.to, fuzzy: true })}
            onNavigate={onNavigate}
          />
        ))}
        <NavItem
          to="/approvals"
          icon={ShieldCheck}
          label="Aprovações"
          isActive={isApprovalsActive}
          badge={pendingCount}
          onNavigate={onNavigate}
        />
      </div>

      {/* Grupo Análise */}
      <div className="mt-2 flex flex-col gap-0.5">
        <span className="px-3 py-1 text-xs font-medium text-muted-foreground">Análise</span>
        {navItemsAnalytics.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            isActive={!!matchRoute({ to: item.to, fuzzy: true })}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* Grupo Integrações */}
      <div className="mt-2 flex flex-col gap-0.5">
        <span className="px-3 py-1 text-xs font-medium text-muted-foreground">Integrações</span>
        <NavItem
          to="/adapters"
          icon={Plug}
          label="Adaptadores"
          isActive={isAdaptersActive}
          onNavigate={onNavigate}
        />
      </div>

      {/* Grupo Sistema */}
      <div className="mt-2 flex flex-col gap-0.5">
        <span className="px-3 py-1 text-xs font-medium text-muted-foreground">Sistema</span>
        <NavItem
          to="/security"
          icon={ShieldAlert}
          label="Segurança"
          isActive={isSecurityActive}
          dot={hasCriticalEvents}
          onNavigate={onNavigate}
        />
        <NavItem
          to="/compliance"
          icon={ClipboardCheck}
          label="Conformidade"
          isActive={isComplianceActive}
          onNavigate={onNavigate}
        />
        <NavItem
          to="/fleet"
          icon={Network}
          label="Fleet"
          isActive={isFleetActive}
          onNavigate={onNavigate}
        />
        <NavItem
          to="/settings/otel"
          icon={Telescope}
          label="OpenTelemetry"
          isActive={isOtelActive}
          onNavigate={onNavigate}
        />
        <NavItem
          to="/settings"
          icon={Settings}
          label="Configurações"
          isActive={isSettingsActive}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
