import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useCreateInstance } from "@/api/evolution";
import { toast } from "sonner";

const schema = z.object({
  instanceName: z
    .string()
    .min(3, "Minimo 3 caracteres")
    .max(30, "Maximo 30 caracteres")
    .regex(/^[a-z0-9-]+$/, "Apenas letras minusculas, numeros e hifens"),
});

type FormValues = z.infer<typeof schema>;

interface CreateInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInstanceDialog({ open, onOpenChange }: CreateInstanceDialogProps) {
  const navigate = useNavigate();
  const create = useCreateInstance();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { instanceName: "" },
  });

  async function onSubmit(values: FormValues) {
    create.mutate(values, {
      onSuccess: () => {
        toast.success(`Instancia "${values.instanceName}" criada`);
        onOpenChange(false);
        form.reset();
        navigate({
          to: "/conectividade/whatsapp/$name",
          params: { name: values.instanceName },
          search: { tab: "qr" },
        });
      },
      onError: (err) => {
        form.setError("instanceName", { message: err.message });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) form.reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Instancia</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="instanceName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da instancia</FormLabel>
                  <FormControl>
                    <Input placeholder="minha-instancia" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
