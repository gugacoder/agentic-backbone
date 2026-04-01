import type { ComponentType } from "react"

export type Tier = "admin" | "manager" | "attendant"

export interface MenuItem {
  id: string
  label: string
  icon: ComponentType<{ size?: number; className?: string }>
  route: string
  /** Minimum tier required to see this item. Omit to show to all tiers. */
  minTier?: Tier
}

export interface MenuGroup {
  id: string
  label: string
  items: MenuItem[]
}

export interface MenuContext {
  id: string
  groups: MenuGroup[]
  defaultShortcuts?: string[]
}
