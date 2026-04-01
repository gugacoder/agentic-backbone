import * as React from "react"
import { cn } from "../../lib/utils.js"
import type { MenuContext, Tier } from "./types.js"

const TIER_RANK: Record<Tier, number> = {
  admin: 3,
  manager: 2,
  attendant: 1,
}

interface AppMenuProps {
  context: MenuContext
  userTier: Tier
  currentRoute: string
  onNavigate: (route: string) => void
  collapsed: boolean
}

export function AppMenu({
  context,
  userTier,
  currentRoute,
  onNavigate,
  collapsed,
}: AppMenuProps) {
  const userRank = TIER_RANK[userTier]

  const visibleGroups = context.groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.minTier) return true
        return userRank >= TIER_RANK[item.minTier]
      }),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <nav className="flex flex-col gap-1 px-2 py-2">
      {visibleGroups.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          {!collapsed && (
            <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {group.label}
            </span>
          )}
          {group.items.map((item) => {
            const isActive =
              currentRoute === item.route ||
              (item.route !== "/" && currentRoute.startsWith(item.route))
            const Icon = item.icon

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.route)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex min-h-[2.75rem] w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
