import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, ServerOff } from "lucide-react";
import { evolutionInstanceSettingsQuery, useUpdateInstanceSettings, friendlyMessage } from "@/api/evolution";
import { toast } from "sonner";

const settingsSchema = z.object({
  reject_call: z.boolean(),
  msg_call: z.string(),
  groups_ignore: z.boolean(),
  always_online: z.boolean(),
  read_messages: z.boolean(),
  read_status: z.boolean(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

interface InstanceSettingsFormProps {
  instanceName: string;
}

export function InstanceSettingsForm({ instanceName }: InstanceSettingsFormProps) {
  const { data: settings, isLoading } = useQuery(evolutionInstanceSettingsQuery(instanceName));
  const updateSettings = useUpdateInstanceSettings();
  const queryClient = useQueryClient();

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      reject_call: false,
      msg_call: "",
      groups_ignore: false,
      always_online: false,
      read_messages: false,
      read_status: false,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [settings, form]);

  function onSubmit(values: SettingsValues) {
    updateSettings.mutate(
      { name: instanceName, settings: values },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            toast.error(friendlyMessage(result.error ?? ""));
            return;
          }
          toast.success("Configuracoes salvas");
        },
        onError: (err) => toast.error(`Falha ao salvar: ${err.message}`),
      }
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <ServerOff className="h-8 w-8" />
          <p className="text-sm">Configurações indisponíveis</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["evolution", "instances", instanceName, "settings"] })}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Configuracoes</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="reject_call"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Rejeitar chamadas</FormLabel>
                    <FormDescription>Rejeitar chamadas automaticamente</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="msg_call"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem ao rejeitar chamada</FormLabel>
                  <FormControl>
                    <Input placeholder="Nao atendemos por chamada" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="groups_ignore"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Ignorar grupos</FormLabel>
                    <FormDescription>Ignorar mensagens de grupos</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="always_online"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Sempre online</FormLabel>
                    <FormDescription>Manter status sempre online</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="read_messages"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Marcar como lida</FormLabel>
                    <FormDescription>Marcar mensagens como lidas automaticamente</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="read_status"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Marcar status como visto</FormLabel>
                    <FormDescription>Marcar status do WhatsApp como visto</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
