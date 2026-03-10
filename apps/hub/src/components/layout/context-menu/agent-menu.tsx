import { Link, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Settings,
  MessageSquare,
  Brain,
  Clock,
  BookOpen,
  FlaskConical,
  Star,
  Webhook,
  GitMerge,
  Gauge,
  History,
  Layers,
  Plug,
  GitBranch,
  Mail,
  BarChart3,
  Network,
  ShieldAlert,
  ClipboardCheck,
  ArrowLeft,
} from "lucide-react";
import { agentQueryOptions } from "@/api/agents";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface MenuGroup {
  label?: string;
  items: {
    label: string;
    icon: React.ElementType;
    to: string;
  }[];
}

const groups = (agentId: string): MenuGroup[] => [
  {
    items: [
      { label: "Configuração", icon: Settings, to: `/agents/${agentId}/config` },
      { label: "Conversas", icon: MessageSquare, to: `/conversations?agent=${agentId}` },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { label: "Memória", icon: Brain, to: `/agents/${agentId}/memory` },
      { label: "Knowledge", icon: BookOpen, to: `/agents/${agentId}/knowledge` },
      { label: "Agenda", icon: Clock, to: `/agents/${agentId}/cron` },
    ],
  },
  {
    label: "Qualidade",
    items: [
      { label: "Avaliação", icon: FlaskConical, to: `/agents/${agentId}/evaluation` },
      { label: "Qualidade", icon: Star, to: `/agents/${agentId}/quality` },
      { label: "Benchmarks", icon: BarChart3, to: `/agents/${agentId}/benchmarks` },
    ],
  },
  {
    label: "Integrações",
    items: [
      { label: "Webhooks", icon: Webhook, to: `/agents/${agentId}/webhooks` },
      { label: "Canais", icon: Mail, to: `/agents/${agentId}/channels` },
      { label: "MCP Tools", icon: Plug, to: `/agents/${agentId}/mcp-tools` },
      { label: "Handoffs", icon: GitMerge, to: `/agents/${agentId}/handoffs` },
    ],
  },
  {
    label: "Operações",
    items: [
      { label: "Routing", icon: GitBranch, to: `/agents/${agentId}/routing` },
      { label: "Workflows", icon: Network, to: `/agents/${agentId}/workflows` },
      { label: "Sandbox", icon: Layers, to: `/agents/${agentId}/sandbox` },
    ],
  },
  {
    label: "Governança",
    items: [
      { label: "Versões", icon: History, to: `/agents/${agentId}/versions` },
      { label: "Quotas", icon: Gauge, to: `/agents/${agentId}/quotas` },
      { label: "Circuit Breaker", icon: ShieldAlert, to: `/agents/${agentId}/circuit-breaker` },
      { label: "Conformidade", icon: ClipboardCheck, to: `/agents/${agentId}/compliance` },
    ],
  },
];

interface AgentNavMenuProps {
  agentId: string;
  activeSection: string;
  onNavigate?: () => void;
}

export function AgentNavMenu({ agentId, onNavigate }: AgentNavMenuProps) {
  const matchRoute = useMatchRoute();
  const { data: agent } = useQuery(agentQueryOptions(agentId));

  const isOverviewActive = !!matchRoute({
    to: "/agents/$id/",
    params: { id: agentId },
    fuzzy: false,
  });

  return (
    <div className="flex flex-col gap-0.5">
      {/* Avatar do agente — link para Visão Geral */}
      <Link
        to={`/agents/${agentId}` as any}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-3 transition-colors",
          isOverviewActive
            ? "bg-sidebar-accent"
            : "hover:bg-sidebar-accent",
        )}
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20">
          <Bot className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{agent?.slug ?? agentId}</p>
          <p className="text-xs text-muted-foreground">Agente</p>
        </div>
      </Link>

      <Link
        to="/agents"
        onClick={onNavigate}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <ArrowLeft className="size-4 shrink-0" />
        <span>Agentes</span>
      </Link>

      <Separator className="my-1" />

      {groups(agentId).map((group, gi) => (
        <div key={gi}>
          {gi > 0 && <Separator className="my-1.5" />}
          {group.label && (
            <span className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </span>
          )}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = !!matchRoute({ to: item.to as any, fuzzy: true });

              return (
                <Link
                  key={item.to}
                  to={item.to as any}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
