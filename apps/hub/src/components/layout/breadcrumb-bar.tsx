import { useLocation, Link } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Fragment } from "react";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  chat: "Chat",
  agents: "Agents",
  channels: "Channels",
  tasks: "Tasks",
  memory: "Memory",
  users: "Users",
  skills: "Skills",
  tools: "Tools",
  adapters: "Adapters",
  system: "System",
  new: "New",
  edit: "Edit",
};

export function BreadcrumbBar() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="mr-2 !h-4 hidden md:block" />
      <Breadcrumb>
        <BreadcrumbList>
          {segments.map((segment, i) => {
            const isLast = i === segments.length - 1;
            const href = "/" + segments.slice(0, i + 1).join("/");
            const label = routeLabels[segment] ?? segment;

            return (
              <Fragment key={href}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={href}>{label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
