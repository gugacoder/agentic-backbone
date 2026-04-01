import type { ComponentType } from "react"

export type Tier = "admin" | "manager" | "attendant"

export interface MenuItem {
  id: string
  label: string
  icon?: ComponentType<{ className?: string }>
  route?: string
  tier?: Tier | Tier[]
  badge?: string | number
  children?: MenuItem[]
}

export interface MenuGroup {
  id: string
  label?: string
  items: MenuItem[]
  tier?: Tier | Tier[]
}

export interface MenuContext {
  id: string
  groups: MenuGroup[]
  defaultShortcuts?: string[]
}
