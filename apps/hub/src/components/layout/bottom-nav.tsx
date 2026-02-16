import { useLocation, Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Bot,
  Brain,
  MessageSquare,
  MoreHorizontal,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuthStore } from "@/lib/auth";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Radio,
  Users,
  Sparkles,
  Wrench,
  Plug,
  Terminal,
  Settings,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Chat", href: "/chat", icon: MessageSquare },
  { title: "Agents", href: "/agents", icon: Bot },
  { title: "Memory", href: "/memory", icon: Brain },
];

const moreItems = [
  { title: "Channels", href: "/channels", icon: Radio },
  { title: "Skills", href: "/skills", icon: Sparkles },
  { title: "Tools", href: "/tools", icon: Wrench },
  { title: "Adapters", href: "/adapters", icon: Plug },
  { title: "Jobs", href: "/jobs", icon: Terminal },
  { title: "Users", href: "/users", icon: Users },
  { title: "System", href: "/system", icon: Settings },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const { isSysuser, logout } = useAuthStore();

  const filteredMoreItems = isSysuser
    ? moreItems
    : moreItems.filter((i) => i.href !== "/users" && i.href !== "/system" && i.href !== "/jobs");

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden safe-area-pb">
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs text-muted-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-safe">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            {filteredMoreItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg p-3 text-sm",
                  location.pathname.startsWith(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs">{item.title}</span>
              </Link>
            ))}
          </div>
          <Separator />
          <div className="flex items-center justify-between py-3">
            <Button
              variant="ghost"
              className="justify-start gap-2 text-muted-foreground"
              onClick={() => {
                setMoreOpen(false);
                logout();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
            <ThemeToggle />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
