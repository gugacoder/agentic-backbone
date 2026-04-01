interface AppNavBrandProps {
  logoExpanded?: string
  logoExpandedDark?: string
  logoCollapsed?: string
  logoCollapsedDark?: string
  alt?: string
  collapsed?: boolean
}

export function AppNavBrand({
  logoExpanded,
  logoExpandedDark,
  logoCollapsed,
  logoCollapsedDark,
  alt = "Logo",
  collapsed = false,
}: AppNavBrandProps) {
  const lightSrc = collapsed ? (logoCollapsed ?? logoExpanded) : logoExpanded
  const darkSrc = collapsed
    ? (logoCollapsedDark ?? logoExpandedDark ?? logoCollapsed ?? logoExpanded)
    : (logoExpandedDark ?? logoExpanded)

  return (
    <div className="flex items-center gap-2 px-1">
      {lightSrc && (
        <img
          src={lightSrc}
          alt={alt}
          className={`dark:hidden ${collapsed ? "h-6" : "h-7"}`}
        />
      )}
      {darkSrc && (
        <img
          src={darkSrc}
          alt={alt}
          className={`hidden dark:block ${collapsed ? "h-6" : "h-7"}`}
        />
      )}
    </div>
  )
}
