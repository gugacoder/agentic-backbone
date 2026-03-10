import { usePWA } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function PWAUpdatePrompt() {
  const { needsUpdate, update } = usePWA();

  if (!needsUpdate) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 md:bottom-4">
      <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
        <RefreshCw className="h-4 w-4 text-primary" />
        <span className="text-sm">New version available</span>
        <Button size="sm" onClick={update}>
          Update
        </Button>
      </div>
    </div>
  );
}
