import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Radio,
  Calendar,
  Cpu,
  Bell,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" as const },
  { label: "Agentes", icon: Bot, to: "/agents" as const },
  { label: "Conversas", icon: MessageSquare, to: "/conversations" as const },
  { label: "Canais", icon: Radio, to: "/channels" as const },
  { label: "Agenda", icon: Calendar, to: "/cron" as const },
  { label: "Jobs", icon: Cpu, to: "/jobs" as const },
  { label: "Notificacoes", icon: Bell, to: "/notifications" as const },
  { label: "Configuracoes", icon: Settings, to: "/settings" as const },
] as const;

export function AppSidebar() {
  const matchRoute = useMatchRoute();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <span className="text-lg font-semibold tracking-tight">AB Hub</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
