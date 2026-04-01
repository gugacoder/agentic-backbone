import { useState } from "react"
import type { ComponentType } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "./drawer"
import { Button } from "./button"

export interface ShortcutItem {
  id: string
  label: string
  icon?: ComponentType<{ className?: string }>
  route?: string
}

interface ShortcutEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slots: ShortcutItem[]
  availableItems: ShortcutItem[]
  onSave: (items: ShortcutItem[]) => void
}

export function ShortcutEditor({
  open,
  onOpenChange,
  slots,
  availableItems,
  onSave,
}: ShortcutEditorProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    slots.map((s) => s.id)
  )

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function handleSave() {
    const items = selected
      .map((id) => availableItems.find((item) => item.id === id))
      .filter((item): item is ShortcutItem => !!item)
    onSave(items)
    onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[60vh]">
        <DrawerHeader>
          <DrawerTitle>Editar atalhos</DrawerTitle>
          <DrawerDescription>
            Selecione os atalhos que deseja exibir na barra inferior.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          <div className="space-y-1">
            {availableItems.map((item) => {
              const Icon = item.icon
              const isSelected = selected.includes(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {Icon && <Icon className="size-5 shrink-0" />}
                  <span className="flex-1 text-left">{item.label}</span>
                  <span
                    className={`size-4 rounded-full border-2 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30"
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>
        <div className="border-t p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          <Button onClick={handleSave} className="w-full">
            Salvar
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
