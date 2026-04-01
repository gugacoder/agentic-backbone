import * as React from "react"
import {
  Root,
  Drawer as DrawerNamespace,
  Overlay as DrawerOverlayPrimitive,
  Portal as DrawerPortalPrimitive,
  type DialogProps,
} from "vaul"
import { cn } from "../lib/utils.js"

export function Drawer({
  shouldScaleBackground = true,
  ...props
}: DialogProps) {
  return (
    <Root
      shouldScaleBackground={shouldScaleBackground}
      {...props}
    />
  )
}
Drawer.displayName = "Drawer"

export const DrawerTrigger = DrawerNamespace.Trigger

export const DrawerPortal = DrawerPortalPrimitive

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerOverlayPrimitive>,
  React.ComponentPropsWithoutRef<typeof DrawerOverlayPrimitive>
>(({ className, ...props }, ref) => (
  <DrawerOverlayPrimitive
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/60", className)}
    {...props}
  />
))
DrawerOverlay.displayName = "DrawerOverlay"

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerNamespace.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerNamespace.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerNamespace.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-[10px] border border-border bg-background",
        className
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {children}
    </DrawerNamespace.Content>
  </DrawerPortal>
))
DrawerContent.displayName = "DrawerContent"

export function DrawerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
      {...props}
    />
  )
}
DrawerHeader.displayName = "DrawerHeader"

export function DrawerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}
DrawerFooter.displayName = "DrawerFooter"

export const DrawerTitle = DrawerNamespace.Title

export const DrawerDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DrawerDescription.displayName = "DrawerDescription"
