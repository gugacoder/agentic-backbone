import * as React from "react"
import * as Menu from "@base-ui/react/menu"
import { cn } from "../../lib/utils.js"

interface AvatarMenuUser {
  name: string
  email: string
  role: string
  image?: string
}

interface AvatarMenuProps {
  user: AvatarMenuUser
  onLogout: () => void
  theme: string
  onThemeChange: (t: string) => void
  collapsed?: boolean
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
}

export function AvatarMenu({
  user,
  onLogout,
  theme,
  onThemeChange,
  collapsed = false,
}: AvatarMenuProps) {
  const initials = getInitials(user.name)
  const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark"
  const themeLabel =
    theme === "dark" ? "Tema escuro" : theme === "light" ? "Tema claro" : "Tema do sistema"

  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <button
            type="button"
            className={cn(
              "flex min-h-[2.75rem] w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              collapsed && "justify-center px-0"
            )}
          />
        }
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold overflow-hidden"
          )}
        >
          {user.image ? (
            <img src={user.image} alt={user.name} className="size-full object-cover" />
          ) : (
            initials
          )}
        </span>
        {!collapsed && (
          <div className="flex flex-col items-start text-left min-w-0">
            <span className="truncate text-sm font-medium text-sidebar-foreground leading-tight">
              {user.name}
            </span>
            <span className="truncate text-xs text-sidebar-foreground/60 leading-tight">
              {user.role}
            </span>
          </div>
        )}
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={4}>
          <Menu.Popup className="z-50 min-w-[180px] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg text-popover-foreground">
            <div className="px-2 py-1.5 mb-1">
              <p className="text-sm font-medium truncate">{user.name}</p>
              {user.email && (
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              )}
            </div>
            <div className="h-px bg-border my-1" />
            <Menu.Item
              className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground outline-none"
              onClick={() => onThemeChange(nextTheme)}
            >
              {themeLabel}
            </Menu.Item>
            <div className="h-px bg-border my-1" />
            <Menu.Item
              className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground outline-none"
              onClick={onLogout}
            >
              Sair
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
