import type { ComponentType } from "react"
import type { ShortcutSlot } from "./shortcut-bar.js"

export type ShortcutItem = ShortcutSlot & {
  icon: ComponentType<{ className?: string; size?: number }>
}

interface ShortcutEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slots: ShortcutSlot[]
  availableItems: ShortcutItem[]
  onSave: (items: ShortcutItem[]) => void
}

export function ShortcutEditor({ open, onOpenChange, slots, availableItems, onSave }: ShortcutEditorProps) {
  if (!open) return null

  const selectedIds = new Set(slots.map((s) => s.id))

  function toggle(item: ShortcutItem) {
    const newSelected = selectedIds.has(item.id)
      ? availableItems.filter((i) => selectedIds.has(i.id) && i.id !== item.id)
      : [...availableItems.filter((i) => selectedIds.has(i.id)), item]
    onSave(newSelected)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar atalhos"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <div className="w-full max-w-sm rounded-t-2xl md:rounded-2xl bg-background border border-border/50 p-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] md:pb-6">
        <h2 className="text-base font-semibold mb-4">Editar atalhos</h2>
        <div className="grid gap-2">
          {availableItems.map((item) => {
            const Icon = item.icon
            const isSelected = selectedIds.has(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isSelected
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "hover:bg-muted/50 text-foreground border border-transparent"
                }`}
                style={{ minHeight: 44 }}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                {isSelected && (
                  <span className="ml-auto text-xs text-primary">Ativo</span>
                )}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-4 w-full rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          style={{ minHeight: 44 }}
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
