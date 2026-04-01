import * as React from "react"
import * as PopoverBase from "@base-ui/react/popover"
import { cn } from "../lib/utils.js"

export const Popover = PopoverBase.Root

export const PopoverTrigger = PopoverBase.Trigger

export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    align?: "start" | "center" | "end"
    sideOffset?: number
  }
>(({ className, sideOffset = 4, ...props }, ref) => (
  <PopoverBase.Portal>
    <PopoverBase.Positioner sideOffset={sideOffset}>
      <PopoverBase.Popup
        ref={ref}
        className={cn(
          "z-50 w-72 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none",
          "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-100",
          className
        )}
        {...props}
      />
    </PopoverBase.Positioner>
  </PopoverBase.Portal>
))
PopoverContent.displayName = "PopoverContent"
