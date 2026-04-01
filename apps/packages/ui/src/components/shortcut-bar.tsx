import type { ComponentType } from "react"

export interface ShortcutSlot {
  id: string
  label: string
  icon: ComponentType<{ className?: string; size?: number }>
  route: string
}

interface ShortcutBarProps {
  slots: ShortcutSlot[]
  currentRoute: string
  onNavigate: (route: string) => void
  onMenuClick: () => void
}

export function ShortcutBar({ slots, currentRoute, onNavigate, onMenuClick }: ShortcutBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex h-[calc(env(safe-area-inset-bottom,0px)+2.75rem)] items-start border-t border-border/50 bg-background/95 backdrop-blur-sm pt-0 md:hidden z-40">
      <div className="flex w-full items-center justify-around px-2 pt-1">
        {slots.map((slot) => {
          const Icon = slot.icon
          const isActive = currentRoute === slot.route
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onNavigate(slot.route)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label={slot.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-5" />
              <span className="text-[10px] font-medium leading-tight">{slot.label}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          style={{ minWidth: 44, minHeight: 44 }}
          aria-label="Menu"
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          <span className="text-[10px] font-medium leading-tight">Menu</span>
        </button>
      </div>
    </nav>
  )
}
