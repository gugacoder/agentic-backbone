import { useState } from "react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { Bot, MessageSquare, Radio, Settings, Menu } from "lucide-react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { NavMenu } from "@/components/layout/nav-menu";

const navItems = [
  { label: "Agentes", icon: Bot, to: "/agents" as const },
  { label: "Conversas", icon: MessageSquare, to: "/conversations" as const },
  { label: "Canais", icon: Radio, to: "/channels" as const },
  { label: "Config", icon: Settings, to: "/settings" as const },
] as const;

export function BottomNav() {
  const matchRoute = useMatchRoute();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t bg-background md:hidden">
        {navItems.map((item) => {
          const isActive = !!matchRoute({ to: item.to, fuzzy: true });
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-xs transition-colors",
                isActive ? "text-primary font-medium" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          onClick={() => setOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Menu className="size-5" />
          <span>Menu</span>
        </button>
      </nav>

      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-background">
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
            <Drawer.Title className="px-4 pt-3 pb-1 text-lg font-semibold">
              Agentic Backbone
            </Drawer.Title>
            <div className="max-h-[80dvh] overflow-y-auto py-2 pb-8">
              <NavMenu onNavigate={() => setOpen(false)} />
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
