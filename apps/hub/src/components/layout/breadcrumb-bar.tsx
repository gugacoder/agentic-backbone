import { useMatches, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUIStore } from "@/lib/store";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAuthStore } from "@/lib/auth";

export function BreadcrumbBar() {
  const matches = useMatches();
  const navigate = useNavigate();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const userRole = useAuthStore((s) => s.user?.role);
  const isSysadmin = userRole === "sysuser";

  // Build crumbs from all matches that declare loaderData.title or staticData.title
  const crumbs: { title: string; pathname: string }[] = [];
  for (const match of matches) {
    const ld = (match.loaderData as any) ?? {};
    const sd = (match.staticData as any) ?? {};
    const t = ld.title ?? sd.title;
    if (t && t !== crumbs[crumbs.length - 1]?.title) {
      crumbs.push({ title: t, pathname: match.pathname });
    }
  }

  // Current page data: último match que declare título (loaderData ou staticData)
  const lastMatchWithTitle = [...matches].reverse().find((m) => {
    const ld = (m.loaderData as any) ?? {};
    const sd = (m.staticData as any) ?? {};
    return ld.title ?? sd.title;
  });
  const ld = (lastMatchWithTitle?.loaderData as any) ?? {};
  const sd = (lastMatchWithTitle?.staticData as any) ?? {};
  const title: string | undefined = ld.title ?? sd.title;
  const description: string | undefined = ld.description ?? sd.description;

  const isNested = crumbs.length > 1;
  const parentCrumbs = crumbs.slice(0, -1);

  const isDark =
    theme === "dark" ||
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  function toggleTheme() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      
      {isNested && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: ".." as any })}
          aria-label="Voltar"
          className="shrink-0 sm:hidden"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {parentCrumbs.length > 0 && (
        <nav className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground ml-0">
          {parentCrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3" />}
              <button
                onClick={() => navigate({ to: crumb.pathname as any })}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                {crumb.title}
              </button>
            </span>
          ))}
          <ChevronRight className="size-3" />
        </nav>
      )}

      {title && (
        <div className="flex flex-col justify-center min-w-0">
          <span className="text-lg font-semibold leading-tight truncate">{title}</span>
          {description && (
            <span className="text-xs text-muted-foreground leading-tight truncate">{description}</span>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {isSysadmin && (
          <Badge variant="secondary" className="text-xs font-semibold">
            Admin
          </Badge>
        )}
        <NotificationBell />
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
