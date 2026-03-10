import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { adaptersQuery, useDeleteAdapter } from "@/api/adapters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useSSE } from "@/hooks/use-sse";
import { Plug, Trash2 } from "lucide-react";
import { useState } from "react";

export function AdaptersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: adapters } = useQuery(adaptersQuery);
  const deleteAdapter = useDeleteAdapter();
  const [deleteTarget, setDeleteTarget] = useState<{
    scope: string;
    slug: string;
  } | null>(null);

  useSSE({
    url: "/system/events",
    onEvent: (type) => {
      if (type === "registry:adapters") {
        queryClient.invalidateQueries({ queryKey: ["adapters"] });
      }
    },
  });

  const list = adapters ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adapters"
        description={`${list.length} adapter(s)`}
      />

      {!list.length ? (
        <EmptyState
          icon={Plug}
          title="No adapters"
          description="No adapter configurations found. Create adapters by adding directories to context/shared/adapters/."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((adapter) => (
            <Card
              key={`${adapter.source}-${adapter.slug}`}
              className="group cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() =>
                navigate({
                  to: "/adapters/$scope/$slug",
                  params: { scope: adapter.source, slug: adapter.slug },
                  search: { tab: "overview" },
                })
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{adapter.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({
                        scope: adapter.source,
                        slug: adapter.slug,
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {adapter.description || "No description"}
                </p>
                <div className="flex gap-2">
                  <Badge variant="outline">{adapter.source}</Badge>
                  <Badge variant="secondary">{adapter.connector}</Badge>
                  <Badge variant="secondary">{adapter.policy}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Adapter"
        description={`Delete adapter "${deleteTarget?.slug}"? This will remove the entire adapter directory.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteAdapter.mutate(deleteTarget);
        }}
      />
    </div>
  );
}
