import { useQuery } from "@tanstack/react-query";
import { toolsQuery, useDeleteTool } from "@/api/tools";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Wrench, Trash2 } from "lucide-react";
import { useState } from "react";

export function ToolsPage() {
  const { data: tools, isLoading } = useQuery(toolsQuery);
  const deleteTool = useDeleteTool();
  const [deleteTarget, setDeleteTarget] = useState<{ scope: string; slug: string } | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Tools" description={`${tools?.length ?? 0} tool(s) available`} />

      {!tools?.length ? (
        <EmptyState icon={Wrench} title="No tools" description="No tools configured yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Card key={`${tool.source}-${tool.slug}`} className="group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{String(tool.metadata.name ?? tool.slug)}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setDeleteTarget({ scope: tool.source, slug: tool.slug })}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{String(tool.metadata.description ?? "")}</p>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">{tool.source}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Tool" description={`Delete tool ${deleteTarget?.slug}?`} confirmText="Delete" variant="destructive" onConfirm={() => { if (deleteTarget) deleteTool.mutate(deleteTarget); }} />
    </div>
  );
}
