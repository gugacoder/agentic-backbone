import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu"
import { SidebarMenuButton, SidebarMenuItem } from "../sidebar"
import { UserCircle, SignOut, Sun, Moon } from "@phosphor-icons/react"

interface AvatarUser {
  name: string
  email: string
  role?: string
  image?: string
}

interface AvatarMenuProps {
  user: AvatarUser
  onLogout: () => void
  theme?: string
  onThemeChange?: (theme: string) => void
  collapsed?: boolean
}

export function AvatarMenu({
  user,
  onLogout,
  theme,
  onThemeChange,
  collapsed = false,
}: AvatarMenuProps) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={collapsed ? user.name : undefined}>
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {user.image ? (
                <img src={user.image} alt={user.name} className="size-6 rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.role ?? user.email}
                </span>
              </div>
            )}
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          {onThemeChange && (
            <>
              <DropdownMenuItem
                onSelect={() => onThemeChange(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
                {theme === "dark" ? "Tema claro" : "Tema escuro"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={onLogout}>
            <SignOut className="size-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
