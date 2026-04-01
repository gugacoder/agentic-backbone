import type { ReactNode } from "react"

interface Breadcrumb {
  label: string
  href: string
}

interface BreadcrumbBarProps {
  leftSlot?: ReactNode
  breadcrumbs: Breadcrumb[]
  title?: string
  onNavigate: (route: string) => void
  onBack?: () => void
  showBackButton?: boolean
}

export function BreadcrumbBar({
  leftSlot,
  breadcrumbs,
  onNavigate,
  onBack,
  showBackButton,
}: BreadcrumbBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/50 px-3">
      {leftSlot}
      {showBackButton && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          style={{ minWidth: 32, minHeight: 32 }}
          aria-label="Voltar"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm overflow-hidden">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {index > 0 && <span className="text-muted-foreground/50">/</span>}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium text-foreground truncate max-w-[160px]">{crumb.label}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(crumb.href)}
                className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]"
              >
                {crumb.label}
              </button>
            )}
          </span>
        ))}
      </nav>
    </header>
  )
}
