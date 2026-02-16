import { useLocation, Link, useNavigate } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Bot,
  Radio,
  Brain,
  Users,
  Sparkles,
  Wrench,
  Plug,
  Cable,
  MessageCircle,
  Settings,
  Activity,
  Terminal,
  LogOut,
  MessageSquare,
} from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useAuthStore } from "@/lib/auth";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const mainNav = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Chat", href: "/chat", icon: MessageSquare },
  { title: "Agents", href: "/agents", icon: Bot },
  { title: "Memory", href: "/memory", icon: Brain },
];

const resourceNav = [
  { title: "Channels", href: "/channels", icon: Radio },
  { title: "Skills", href: "/skills", icon: Sparkles },
  { title: "Tools", href: "/tools", icon: Wrench },
  { title: "Adapters", href: "/adapters", icon: Plug },
];

const connectivityNav = [
  { title: "WhatsApp", href: "/conectividade/whatsapp", icon: MessageCircle },
];

const adminNav = [
  { title: "Jobs", href: "/jobs", icon: Terminal },
  { title: "Users", href: "/users", icon: Users },
  { title: "System", href: "/system", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { displayName, user, isSysuser, logout } = useAuthStore();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2">
          <Activity className="h-5 w-5 shrink-0" />
          <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
            Backbone Hub
          </span>
        </Link>
        {!online && (
          <span className="text-xs text-destructive group-data-[collapsible=icon]:hidden">
            Offline
          </span>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.startsWith(item.href)}
                    tooltip={item.title}
                  >
                    <Link to={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {resourceNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.startsWith(item.href)}
                    tooltip={item.title}
                  >
                    <Link to={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>
            <Cable className="h-3.5 w-3.5 mr-1 inline-block" />
            Conectividade
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {connectivityNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.startsWith(item.href)}
                    tooltip={item.title}
                  >
                    <Link to={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isSysuser && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname.startsWith(item.href)}
                      tooltip={item.title}
                    >
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t px-4 py-3">
        <div className="flex flex-col gap-1 group-data-[collapsible=icon]:hidden">
          <span className="text-xs font-medium truncate">{displayName ?? user}</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 text-muted-foreground group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            onClick={() => {
              logout();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
