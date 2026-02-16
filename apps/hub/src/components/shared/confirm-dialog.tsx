import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  typedConfirm?: string; // If set, user must type this to confirm
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  typedConfirm,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");

  const canConfirm = typedConfirm ? typed === typedConfirm : true;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setTyped(""); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {typedConfirm && (
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-2">
              Type <span className="font-mono font-semibold">{typedConfirm}</span> to confirm:
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={typedConfirm}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { setTyped(""); onOpenChange(false); }}>
            {cancelText}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={!canConfirm}
            onClick={() => { setTyped(""); onConfirm(); onOpenChange(false); }}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
