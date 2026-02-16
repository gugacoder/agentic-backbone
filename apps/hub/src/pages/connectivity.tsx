import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { evolutionInstancesQuery } from "@/api/evolution";

export function ConnectivityPage() {
  const { data: instances } = useQuery(evolutionInstancesQuery);

  const onlineCount = instances?.filter((i) => i.state === "open").length ?? 0;
  const offlineCount = instances?.filter((i) => i.state === "close").length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conectividade"
        description="Canais de comunicacao disponiveis"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/conectividade/whatsapp" search={{ view: "monitor" }} className="block">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <MessageCircle className="h-8 w-8 text-chart-2" />
              <CardTitle>WhatsApp</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {onlineCount > 0 || offlineCount > 0
                  ? `${onlineCount} online · ${offlineCount} offline`
                  : "Gerenciamento via Evolution API"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
