import { Link } from "@tanstack/react-router";
import { ChevronsUpDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavMenu } from "@/components/layout/nav-menu";
import { useAuthStore } from "@/lib/auth";
import { useUIStore } from "@/lib/store";

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
          {initials}
        </span>
        <span className="flex-1 truncate">{user?.displayName ?? "Usuário"}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.role}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link to="/account" className="flex w-full">
            Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1 text-xs text-muted-foreground">Tema</div>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">Claro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Escuro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">Automático</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {(user?.role === "admin" || user?.role === "system") && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link to="/settings" className="flex w-full">
                Configurações
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} variant="destructive">
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar() {
  return (
    <Sidebar className="text-sm">
      <SidebarHeader className="px-4 py-3">
        <span className="text-lg font-semibold tracking-tight">Agentic Backbone</span>
      </SidebarHeader>
      <SidebarContent className="py-2">
        <NavMenu />
      </SidebarContent>
      <SidebarFooter className="px-2 py-2">
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
