import { useMatches } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/store";

const routeLabels: Record<string, string> = {
  "/agents": "Agentes",
  "/conversations": "Conversas",
  "/channels": "Canais",
  "/cron": "Agenda",
  "/settings": "Configuracoes",
};

const dynamicRoutePatterns: { pattern: RegExp; parent: string }[] = [
  { pattern: /^\/agents\/[^/]+$/, parent: "Agentes" },
];

export function BreadcrumbBar() {
  const matches = useMatches();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const crumbs: string[] = [];
  for (const match of matches) {
    const label = routeLabels[match.pathname];
    if (label) {
      crumbs.push(label);
    } else {
      for (const { pattern, parent } of dynamicRoutePatterns) {
        if (pattern.test(match.pathname)) {
          if (!crumbs.includes(parent)) crumbs.push(parent);
          const segment = match.pathname.split("/").pop();
          if (segment) crumbs.push(segment);
          break;
        }
      }
    }
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  function toggleTheme() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="md:hidden" />
      {crumbs.length > 0 && (
        <>
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <nav className="flex items-center gap-1.5 text-sm">
            {crumbs.map((crumb, i) => (
              <span key={i} className="text-foreground">
                {i > 0 && <span className="mx-1.5 text-muted-foreground">/</span>}
                {crumb}
              </span>
            ))}
          </nav>
        </>
      )}
      <div className="ml-auto">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
