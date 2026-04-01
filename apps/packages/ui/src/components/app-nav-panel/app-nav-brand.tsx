import * as React from "react"
import { cn } from "../../lib/utils.js"

interface AppNavBrandProps {
  logoExpanded: string
  logoExpandedDark: string
  logoCollapsed: string
  logoCollapsedDark: string
  alt: string
  collapsed: boolean
  className?: string
}

export function AppNavBrand({
  logoExpanded,
  logoExpandedDark,
  logoCollapsed,
  logoCollapsedDark,
  alt,
  collapsed,
  className,
}: AppNavBrandProps) {
  return (
    <div className={cn("flex items-center px-1 py-1", className)}>
      {/* Light mode */}
      <img
        src={collapsed ? logoCollapsed : logoExpanded}
        alt={alt}
        className={cn(
          "block dark:hidden transition-all duration-200",
          collapsed ? "h-8 w-8 object-contain" : "h-8 max-w-[140px] object-contain"
        )}
      />
      {/* Dark mode */}
      <img
        src={collapsed ? logoCollapsedDark : logoExpandedDark}
        alt={alt}
        className={cn(
          "hidden dark:block transition-all duration-200",
          collapsed ? "h-8 w-8 object-contain" : "h-8 max-w-[140px] object-contain"
        )}
      />
    </div>
  )
}
