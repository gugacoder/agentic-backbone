import type { ComponentType } from "react"
import { List } from "@phosphor-icons/react"

export interface ShortcutSlot {
  id: string
  label: string
  icon?: ComponentType<{ className?: string }>
  route?: string
}

interface ShortcutBarProps {
  slots: ShortcutSlot[]
  currentRoute: string
  onNavigate: (route: string) => void
  onMenuClick?: () => void
}

export function ShortcutBar({
  slots,
  currentRoute,
  onNavigate,
  onMenuClick,
}: ShortcutBarProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom,0px)] md:hidden">
      {slots.map((slot) => {
        const Icon = slot.icon
        const isActive = slot.route
          ? currentRoute === slot.route || currentRoute.startsWith(slot.route + "/")
          : false

        return (
          <button
            key={slot.id}
            type="button"
            onClick={() => slot.route && onNavigate(slot.route)}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] transition-colors ${
              isActive
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {Icon && <Icon className="size-5" />}
            <span>{slot.label}</span>
          </button>
        )
      })}

      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <List className="size-5" />
          <span>Menu</span>
        </button>
      )}
    </nav>
  )
}
