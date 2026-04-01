import type { ReactNode } from "react"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"

interface Breadcrumb {
  label: string
  href?: string
}

interface BreadcrumbBarProps {
  leftSlot?: ReactNode
  breadcrumbs: Breadcrumb[]
  title?: string
  onNavigate?: (route: string) => void
  onBack?: () => void
  showBackButton?: boolean
}

export function BreadcrumbBar({
  leftSlot,
  breadcrumbs,
  title,
  onNavigate,
  onBack,
  showBackButton = false,
}: BreadcrumbBarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      {leftSlot}

      {showBackButton && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors md:hidden"
        >
          <CaretLeft className="size-4" />
        </button>
      )}

      <nav className="flex items-center gap-1 text-sm text-muted-foreground overflow-hidden">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1
          return (
            <span key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <CaretRight className="size-3 shrink-0 text-muted-foreground/50" />}
              {isLast ? (
                <span className="truncate font-medium text-foreground">{crumb.label}</span>
              ) : (
                <button
                  type="button"
                  className="truncate hover:text-foreground transition-colors"
                  onClick={() => crumb.href && onNavigate?.(crumb.href)}
                >
                  {crumb.label}
                </button>
              )}
            </span>
          )
        })}
      </nav>
    </header>
  )
}
