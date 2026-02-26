import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { systemInfoQuery, systemEnvQuery, contextTreeQuery, useRefreshSystem } from "@/api/system";
import { llmConfigQuery, useUpdateLlmPlan, useUpdateLlmProvider } from "@/api/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, FolderTree, Server, KeyRound, Zap, ChevronRight, Folder, FolderOpen, FileText } from "lucide-react";
import type { LlmPlan, LlmProvider } from "@/api/types";
import { cn } from "@/lib/utils";

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  claude: "Claude",
  ai: "Ai (OpenRouter)",
};

export function SystemPage() {
  const { data: info } = useQuery(systemInfoQuery);
  const { data: env } = useQuery(systemEnvQuery);
  const { data: tree } = useQuery(contextTreeQuery);
  const { data: llmConfig } = useQuery(llmConfigQuery);
  const refresh = useRefreshSystem();
  const updatePlan = useUpdateLlmPlan();
  const updateProvider = useUpdateLlmProvider();

  const activeProvider = llmConfig?.provider ?? "claude";
  const providerPlans = llmConfig?.plans[activeProvider] ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="System"
        description="Server configuration and context management"
        actions={
          <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh Registries
          </Button>
        }
      />

      {/* LLM Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" /> Plano LLM
            </CardTitle>
            {llmConfig && (
              <Tabs
                value={activeProvider}
                onValueChange={(v) => updateProvider.mutate(v as LlmProvider)}
              >
                <TabsList className="h-8">
                  {Object.keys(llmConfig.plans).map((p) => (
                    <TabsTrigger
                      key={p}
                      value={p}
                      className="text-xs px-3 h-7"
                      disabled={updateProvider.isPending}
                    >
                      {PROVIDER_LABELS[p as LlmProvider] ?? p}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {llmConfig ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(providerPlans).map(([key, plan]) => (
                <LlmPlanCard
                  key={`${activeProvider}-${key}`}
                  planKey={key}
                  plan={plan}
                  isActive={llmConfig.active === key}
                  isPending={updatePlan.isPending}
                  onSelect={() => updatePlan.mutate(key)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> Server Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {info ? (
              <>
                <div><span className="text-muted-foreground">Version:</span> {info.version}</div>
                <div><span className="text-muted-foreground">Node:</span> {info.nodeVersion}</div>
                <div><span className="text-muted-foreground">Platform:</span> {info.platform}</div>
                <div><span className="text-muted-foreground">Context Dir:</span> <code className="text-xs">{info.contextDir}</code></div>
              </>
            ) : <p className="text-muted-foreground">Loading...</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Environment</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {env ? Object.entries(env).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="font-mono text-xs">{key}</span>
                <StatusBadge status={value ? "ok" : "pending"} />
              </div>
            )) : <p className="text-muted-foreground">Loading...</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FolderTree className="h-4 w-4" /> Context Tree</CardTitle></CardHeader>
        <CardContent>
          {tree ? (
            <ScrollArea className="max-h-[28rem] overflow-hidden">
              <p className="text-xs text-muted-foreground font-mono mb-2">{tree.root}</p>
              <ContextTree nodes={tree.tree as TreeNode[]} />
            </ScrollArea>
          ) : <p className="text-sm text-muted-foreground">Loading...</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// --- LLM Plan Selection Card ---

function LlmPlanCard({
  planKey,
  plan,
  isActive,
  isPending,
  onSelect,
}: {
  planKey: string;
  plan: LlmPlan;
  isActive: boolean;
  isPending: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={isActive || isPending}
      onClick={onSelect}
      className={cn(
        "rounded-lg border p-4 text-left transition-colors",
        isActive
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/50 hover:bg-accent"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm">{plan.label}</span>
        {isActive && <Badge variant="default">Ativo</Badge>}
      </div>
      <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>
      <div className="space-y-1">
        {Object.entries(plan.profiles).map(([role, profile]) => (
          <div key={role} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground capitalize">{role}</span>
            <span className="font-mono text-[10px]">{formatModelName(profile.model)}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function formatModelName(model: string): string {
  if (model.includes("haiku")) return "Haiku 4.5";
  if (model.includes("sonnet")) return "Sonnet 4.5";
  if (model.includes("opus")) return "Opus 4";
  if (model.includes("gpt-4o-mini")) return "GPT-4o Mini";
  if (model.includes("gpt-4o")) return "GPT-4o";
  if (model.includes("gemini-2.5-pro")) return "Gemini 2.5 Pro";
  if (model.includes("gemini")) return "Gemini";
  return model.split("/").pop() ?? model;
}

// --- Context Tree ---

interface TreeNode {
  name: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

function ContextTree({ nodes }: { nodes: TreeNode[] }) {
  return (
    <div className="text-xs font-mono" role="tree">
      {nodes.map((node) => (
        <TreeItem key={node.name} node={node} depth={0} />
      ))}
    </div>
  );
}

function TreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.type === "directory" && node.children && node.children.length > 0;

  if (!hasChildren) {
    return (
      <div
        className="flex items-center gap-1.5 py-0.5 text-muted-foreground hover:text-foreground transition-colors"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        role="treeitem"
      >
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        <span>{node.name}</span>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} role="treeitem">
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-1.5 py-0.5 hover:bg-accent/50 rounded-sm transition-colors cursor-pointer",
          open ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-90")} />
        {open
          ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
          : <Folder className="h-3.5 w-3.5 shrink-0 text-primary/70" />
        }
        <span className="font-medium">{node.name}</span>
        {!open && node.children && (
          <span className="text-muted-foreground/50 ml-1">{node.children.length}</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {node.children!.map((child) => (
          <TreeItem key={child.name} node={child} depth={depth + 1} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
