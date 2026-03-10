import { useState, useMemo, useCallback } from "react";
import { createFileRoute, useNavigate, useMatch, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Radio, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ChannelCard } from "@/components/channels/channel-card";
import { WhatsAppSetup } from "@/components/channels/whatsapp-setup";
import { channelsQueryOptions } from "@/api/channels";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TypeFilter = "all" | "chat" | "whatsapp" | "voice";

export const Route = createFileRoute("/_authenticated/channels")({
  staticData: { title: "Canais", description: "Canais de comunicação dos agentes" },
  component: ChannelsLayout,
});

function ChannelsLayout() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const isNewRoute = useMatch({ from: "/_authenticated/channels/new", shouldThrow: false });

  const { data: channels, isLoading } = useQuery(channelsQueryOptions());

  const filtered = useMemo(() => {
    if (!channels) return [];
    return channels.filter((ch) => {
      const matchesSearch = ch.slug.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || ch.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [channels, search, typeFilter]);

  const handleCardClick = useCallback(
    (slug: string) => {
      navigate({ to: `/channels/${slug}` as string });
    },
    [navigate],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button size="sm" onClick={() => navigate({ to: "/channels/new" })}>
            <Plus className="mr-1 size-4" />
            Novo Canal
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar canal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as TypeFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="chat">Chat</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="voice">Voz</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Radio />}
          title={channels?.length ? "Nenhum canal encontrado" : "Nenhum canal configurado"}
          description={
            channels?.length
              ? "Tente ajustar sua busca ou filtro."
              : "Em breve voce podera gerenciar canais de comunicacao aqui."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((channel) => (
            <ChannelCard
              key={channel.slug}
              channel={channel}
              onClick={() => handleCardClick(channel.slug)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={!!isNewRoute}
        onOpenChange={(open) => {
          if (!open) navigate({ to: "/channels" });
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar WhatsApp</DialogTitle>
          </DialogHeader>
          <WhatsAppSetup onComplete={() => navigate({ to: "/channels" })} />
        </DialogContent>
      </Dialog>

      <Outlet />
    </div>
  );
}
