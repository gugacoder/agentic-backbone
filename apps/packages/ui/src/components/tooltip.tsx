import * as React from "react"
import * as BaseTooltip from "@base-ui/react/tooltip"
import { cn } from "../lib/utils.js"

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <BaseTooltip.Provider>{children}</BaseTooltip.Provider>
}

export const Tooltip = BaseTooltip.Root

export const TooltipTrigger = BaseTooltip.Trigger

export const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <BaseTooltip.Portal>
    <BaseTooltip.Positioner sideOffset={6}>
      <BaseTooltip.Popup
        ref={ref}
        className={cn(
          "z-50 overflow-hidden rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md",
          className
        )}
        {...props}
      >
        {children}
      </BaseTooltip.Popup>
    </BaseTooltip.Positioner>
  </BaseTooltip.Portal>
))
TooltipContent.displayName = "TooltipContent"
