import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Settings, MessageSquare, ChevronRight } from "lucide-react";
import { channelQueryOptions } from "@/api/channels";
import { ChannelStatusTab } from "@/components/channels/channel-status-tab";
import { ChannelConfigTab } from "@/components/channels/channel-config-tab";
import { ChannelMessageFeed } from "@/components/channels/channel-message-feed";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const tabs = [
  { value: "status", label: "Status", icon: Activity },
  { value: "config", label: "Configuracao", icon: Settings },
  { value: "messages", label: "Mensagens", icon: MessageSquare },
] as const;

type TabValue = (typeof tabs)[number]["value"];

interface ChannelSearchParams {
  tab?: TabValue;
}

export const Route = createFileRoute("/_authenticated/channels/$slug")({
  validateSearch: (search: Record<string, unknown>): ChannelSearchParams => ({
    tab: tabs.some((t) => t.value === search.tab)
      ? (search.tab as TabValue)
      : undefined,
  }),
  component: ChannelDetailPage,
});

function ChannelDetailPage() {
  const { slug } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  const activeTab = tab ?? "status";

  const { data: channel, isLoading } = useQuery(channelQueryOptions(slug));

  function handleTabChange(value: TabValue) {
    navigate({
      to: "/channels/$slug",
      params: { slug },
      search: { tab: value },
      replace: true,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Canal nao encontrado.</p>
        <Link to="/channels" className="text-sm text-primary underline">
          Voltar para Canais
        </Link>
      </div>
    );
  }

  const isConnected = Boolean(channel.metadata?.connected);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link
            to="/channels"
            className="hover:text-foreground transition-colors"
          >
            Canais
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-foreground font-medium">{channel.slug}</span>
        </nav>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {channel.slug}
          </h1>
          <StatusBadge status={isConnected ? "active" : "inactive"} />
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => handleTabChange(v as TabValue)}
      >
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon className="size-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="status">
          <ChannelStatusTab channel={channel} />
        </TabsContent>
        <TabsContent value="config">
          <ChannelConfigTab channel={channel} />
        </TabsContent>
        <TabsContent value="messages">
          <ChannelMessageFeed channelSlug={slug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
