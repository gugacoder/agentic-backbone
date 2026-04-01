import type { MenuContext, Tier, MenuItem, MenuGroup } from "./types"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "../sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../tooltip"

interface AppMenuProps {
  context: MenuContext
  userTier: Tier
  currentRoute: string
  onNavigate: (route: string) => void
  collapsed?: boolean
}

function isTierAllowed(tier: Tier, allowed?: Tier | Tier[]): boolean {
  if (!allowed) return true
  const arr = Array.isArray(allowed) ? allowed : [allowed]
  return arr.includes(tier)
}

function renderItem(
  item: MenuItem,
  userTier: Tier,
  currentRoute: string,
  onNavigate: (route: string) => void,
  collapsed: boolean,
) {
  if (!isTierAllowed(userTier, item.tier)) return null

  const isActive = item.route ? currentRoute === item.route || currentRoute.startsWith(item.route + "/") : false
  const Icon = item.icon

  const button = (
    <SidebarMenuButton
      isActive={isActive}
      tooltip={collapsed ? item.label : undefined}
      onClick={() => item.route && onNavigate(item.route)}
    >
      {Icon && <Icon className="size-4" />}
      <span>{item.label}</span>
      {item.badge != null && (
        <span className="ml-auto text-xs text-muted-foreground">{item.badge}</span>
      )}
    </SidebarMenuButton>
  )

  return (
    <SidebarMenuItem key={item.id}>
      {button}
    </SidebarMenuItem>
  )
}

function renderGroup(
  group: MenuGroup,
  userTier: Tier,
  currentRoute: string,
  onNavigate: (route: string) => void,
  collapsed: boolean,
) {
  if (!isTierAllowed(userTier, group.tier)) return null

  const items = group.items
    .map((item) => renderItem(item, userTier, currentRoute, onNavigate, collapsed))
    .filter(Boolean)

  if (items.length === 0) return null

  return (
    <SidebarGroup key={group.id}>
      {group.label && !collapsed && (
        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      )}
      <SidebarMenu>{items}</SidebarMenu>
    </SidebarGroup>
  )
}

export function AppMenu({
  context,
  userTier,
  currentRoute,
  onNavigate,
  collapsed = false,
}: AppMenuProps) {
  return (
    <TooltipProvider>
      <nav>
        {context.groups.map((group) =>
          renderGroup(group, userTier, currentRoute, onNavigate, collapsed)
        )}
      </nav>
    </TooltipProvider>
  )
}
