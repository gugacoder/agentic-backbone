import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, useSearch } from "@tanstack/react-router";
import { adapterQuery, useTestConnection } from "@/api/adapters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { useSSE } from "@/hooks/use-sse";
import { Zap, CheckCircle, XCircle, Loader2 } from "lucide-react";

export function AdapterDetailPage() {
  const { scope, slug } = useParams({ strict: false }) as {
    scope: string;
    slug: string;
  };
  const { tab } = useSearch({ strict: false }) as { tab: string };
  const navigate = useNavigate({ from: "/adapters/$scope/$slug" });
  const queryClient = useQueryClient();

  const { data: adapter } = useQuery(adapterQuery(scope, slug));
  const testConnection = useTestConnection();

  useSSE({
    url: "/system/events",
    onEvent: (type) => {
      if (type === "registry:adapters") {
        queryClient.invalidateQueries({ queryKey: ["adapters", scope, slug] });
      }
    },
  });

  const setTab = (value: string) => {
    navigate({ search: (prev) => ({ ...prev, tab: value }), replace: true });
  };

  if (!adapter) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading adapter...</p>
      </div>
    );
  }

  const hasConnector = !!adapter.connectorDir;

  return (
    <div className="space-y-6">
      <PageHeader
        title={adapter.name}
        description={adapter.description || "No description"}
      />

      <Tabs value={tab || "overview"} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documentation">Documentation</TabsTrigger>
          <TabsTrigger value="connection">Connection</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Slug:</span>{" "}
                  {adapter.slug}
                </div>
                <div>
                  <span className="text-muted-foreground">Scope:</span>{" "}
                  {adapter.source}
                </div>
                <div>
                  <span className="text-muted-foreground">Connector:</span>{" "}
                  {adapter.connector}
                </div>
                <div>
                  <span className="text-muted-foreground">Policy:</span>{" "}
                  {adapter.policy}
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Directory:</span>{" "}
                  <span className="font-mono text-xs break-all">
                    {adapter.dir}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {adapter.connectorDir && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Connector</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="font-mono text-xs break-all">
                  {adapter.connectorDir}
                </span>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documentation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ADAPTER.yaml</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm font-mono whitespace-pre-wrap bg-muted p-4 rounded-md">
                {adapter.content || "No configuration"}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connection Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasConnector ? (
                <p className="text-sm text-muted-foreground">
                  Connection test not available — connector not found.
                </p>
              ) : (
                <>
                  <Button
                    onClick={() => testConnection.mutate({ scope, slug })}
                    disabled={testConnection.isPending}
                  >
                    {testConnection.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>

                  {testConnection.data && (
                    <div
                      className={`flex items-start gap-2 rounded-md border p-3 ${
                        testConnection.data.status === "ok"
                          ? "border-chart-1/50 bg-chart-1/10"
                          : "border-destructive/50 bg-destructive/10"
                      }`}
                    >
                      {testConnection.data.status === "ok" ? (
                        <CheckCircle className="h-4 w-4 text-chart-1 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      )}
                      <pre className="text-sm whitespace-pre-wrap break-all">
                        {testConnection.data.message}
                      </pre>
                    </div>
                  )}

                  {testConnection.isError && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm">
                        {(testConnection.error as Error).message}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
