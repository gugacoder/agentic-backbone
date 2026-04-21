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
import { Label } from "@/components/ui/label";

interface KbSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string;
  saving: boolean;
  onConfirm: (changeNote: string) => void;
}

export function KbSaveDialog({
  open,
  onOpenChange,
  path,
  saving,
  onConfirm,
}: KbSaveDialogProps) {
  const [note, setNote] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar alterações</DialogTitle>
          <DialogDescription>
            A versão atual de <code className="font-mono text-xs">{path}</code>{" "}
            será preservada no histórico antes da gravação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="kb-change-note">Nota da mudança (opcional)</Label>
          <Input
            id="kb-change-note"
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex: corrigi parágrafo sobre JWT"
            disabled={saving}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(note.trim())}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
