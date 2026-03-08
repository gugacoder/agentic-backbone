import { useState, useCallback, useRef, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type EdgeProps,
  getStraightPath,
  EdgeLabelRenderer,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Bot, ChevronLeft, Save, Zap, AlertCircle, X, Trash2, Play, CheckCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { workflowQueryOptions, updateWorkflow, applyWorkflow, simulateWorkflow } from "@/api/workflows";
import { agentsQueryOptions } from "@/api/agents";
import type { WorkflowNode, WorkflowEdge, ConditionType, EdgeCondition, SimulateResult } from "@/api/workflows";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/workflows/$id")({
  component: WorkflowCanvasPage,
});

// ─── Colors por tipo de condicao ────────────────────────────────────────────

const CONDITION_COLORS: Record<ConditionType, string> = {
  keyword: "#3b82f6",
  intent: "#8b5cf6",
  schedule: "#22c55e",
  channel: "#f97316",
  fallback: "#6b7280",
  sentiment: "#ec4899",
};

const CONDITION_LABELS: Record<ConditionType, string> = {
  keyword: "Palavra-chave",
  intent: "Intenção",
  sentiment: "Sentimento",
  schedule: "Horário",
  channel: "Canal",
  fallback: "Fallback",
};

const DAYS_OF_WEEK = [
  { value: "mon", label: "Seg" },
  { value: "tue", label: "Ter" },
  { value: "wed", label: "Qua" },
  { value: "thu", label: "Qui" },
  { value: "fri", label: "Sex" },
  { value: "sat", label: "Sab" },
  { value: "sun", label: "Dom" },
];

// ─── Node customizado: Agente ─────────────────────────────────────────────

interface AgentNodeData {
  label: string;
  agentId: string;
  isEntry?: boolean;
  highlighted?: boolean;
}

function AgentNode({ data, selected }: NodeProps & { data: AgentNodeData }) {
  return (
    <div
      className={`rounded-xl border-2 bg-card px-4 py-3 shadow-md transition-shadow ${
        data.highlighted
          ? "border-green-500 shadow-green-200 shadow-lg dark:shadow-green-900/30"
          : selected
          ? "border-primary shadow-lg"
          : "border-border"
      } min-w-[160px]`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-primary !bg-background"
      />
      <div className="flex flex-col items-center gap-1.5 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium leading-tight">{data.label}</span>
        <span className="max-w-[140px] truncate text-[10px] text-muted-foreground">
          {data.agentId}
        </span>
        {data.isEntry && (
          <Badge variant="default" className="mt-0.5 text-[10px] px-1.5 py-0">
            Entrada
          </Badge>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-primary !bg-background"
      />
    </div>
  );
}

// ─── Edge customizado: Handoff ─────────────────────────────────────────────

interface HandoffEdgeData {
  label?: string;
  condition?: EdgeCondition;
  onSelect?: (edgeId: string) => void;
}

function HandoffEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps & { data?: HandoffEdgeData }) {
  const conditionType = (data?.condition?.type ?? "fallback") as ConditionType;
  const color = CONDITION_COLORS[conditionType];

  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray={conditionType === "fallback" ? "6 3" : undefined}
        markerEnd={`url(#arrow-${conditionType})`}
        className="cursor-pointer transition-all"
        onClick={() => data?.onSelect?.(id)}
      />
      {/* Arrow marker definitions */}
      <defs>
        {(Object.keys(CONDITION_COLORS) as ConditionType[]).map((type) => (
          <marker
            key={type}
            id={`arrow-${type}`}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={CONDITION_COLORS[type]} />
          </marker>
        ))}
      </defs>
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute cursor-pointer rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-medium shadow-sm transition-opacity"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            color,
            pointerEvents: "all",
          }}
          onClick={() => data?.onSelect?.(id)}
        >
          {data?.label ?? CONDITION_LABELS[conditionType]}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

// ─── Painel de edicao de aresta ──────────────────────────────────────────

interface EdgeEditorPanelProps {
  edge: Edge;
  onUpdate: (id: string, changes: Partial<{ label: string; condition: EdgeCondition }>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function EdgeEditorPanel({ edge, onUpdate, onDelete, onClose }: EdgeEditorPanelProps) {
  const data = edge.data as HandoffEdgeData | undefined;
  const condition = data?.condition ?? { type: "fallback" as ConditionType };
  const label = data?.label ?? "";
  const conditionType = condition.type as ConditionType;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Editar aresta</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Label</Label>
        <Input
          value={label}
          placeholder="Descricao da condicao"
          onChange={(e) =>
            onUpdate(edge.id, { label: e.target.value, condition })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label>Tipo de condicao</Label>
        <Select
          value={conditionType}
          onValueChange={(v) =>
            onUpdate(edge.id, {
              label,
              condition: { type: v as ConditionType },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CONDITION_LABELS) as ConditionType[]).map((t) => (
              <SelectItem key={t} value={t}>
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: CONDITION_COLORS[t] }}
                />
                {CONDITION_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Campos dinamicos por tipo */}
      {(conditionType === "keyword" || conditionType === "intent") && (
        <div className="space-y-1.5">
          <Label>{conditionType === "keyword" ? "Regex / palavra-chave" : "Intencoes (separadas por |)"}</Label>
          <Input
            value={condition.value ?? ""}
            placeholder={conditionType === "keyword" ? "preco|produto" : "compra|produto|preco"}
            onChange={(e) =>
              onUpdate(edge.id, {
                label,
                condition: { ...condition, value: e.target.value },
              })
            }
          />
        </div>
      )}

      {conditionType === "sentiment" && (
        <div className="space-y-1.5">
          <Label>Sentimento</Label>
          <Select
            value={condition.value ?? "positive"}
            onValueChange={(v) =>
              onUpdate(edge.id, {
                label,
                condition: { ...condition, value: v ?? undefined },
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="positive">Positivo</SelectItem>
              <SelectItem value="negative">Negativo</SelectItem>
              <SelectItem value="neutral">Neutro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {conditionType === "schedule" && (
        <>
          <div className="space-y-1.5">
            <Label>Horario (HH:MM-HH:MM)</Label>
            <Input
              value={condition.value ?? ""}
              placeholder="09:00-18:00"
              onChange={(e) =>
                onUpdate(edge.id, {
                  label,
                  condition: { ...condition, value: e.target.value },
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Dias da semana</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((d) => {
                const days = condition.days ?? [];
                const checked = days.includes(d.value);
                return (
                  <label key={d.value} className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...days, d.value]
                          : days.filter((x) => x !== d.value);
                        onUpdate(edge.id, {
                          label,
                          condition: { ...condition, days: next },
                        });
                      }}
                    />
                    {d.label}
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}

      {conditionType === "channel" && (
        <div className="space-y-1.5">
          <Label>Canal</Label>
          <Select
            value={condition.value ?? "whatsapp"}
            onValueChange={(v) =>
              onUpdate(edge.id, {
                label,
                condition: { ...condition, value: v ?? undefined },
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="hub">Hub (Chat)</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator />

      <Button
        variant="destructive"
        size="sm"
        onClick={() => onDelete(edge.id)}
        className="mt-auto"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Remover aresta
      </Button>
    </div>
  );
}

// ─── Painel de edicao de no ─────────────────────────────────────────────

interface NodeEditorPanelProps {
  node: Node;
  onUpdate: (id: string, changes: Partial<AgentNodeData>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function NodeEditorPanel({ node, onUpdate, onDelete, onClose }: NodeEditorPanelProps) {
  const data = node.data as unknown as AgentNodeData;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Editar no</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Label</Label>
        <Input
          value={data.label}
          onChange={(e) => onUpdate(node.id, { label: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Agente</Label>
        <Input value={data.agentId} disabled className="opacity-60" />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={!!data.isEntry}
          onCheckedChange={(v) => onUpdate(node.id, { isEntry: !!v })}
        />
        Marcar como no de Entrada
      </label>

      <Separator />

      <Button
        variant="destructive"
        size="sm"
        onClick={() => onDelete(node.id)}
        className="mt-auto"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Remover no
      </Button>
    </div>
  );
}

// ─── Painel de Simulacao ─────────────────────────────────────────────────

const CHANNEL_OPTIONS = [
  { value: "hub", label: "Hub (Chat)" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "telegram", label: "Telegram" },
];

interface SimulationPanelProps {
  workflowId: string;
  entryNodeId: string | null;
  onClose: () => void;
  onResult: (result: SimulateResult, path: string[]) => void;
}

function SimulationPanel({ workflowId, entryNodeId, onClose, onResult }: SimulationPanelProps) {
  const [input, setInput] = useState("");
  const [channelType, setChannelType] = useState("hub");
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSimulate() {
    if (!input.trim() || !entryNodeId) return;
    setLoading(true);
    try {
      const res = await simulateWorkflow(workflowId, {
        input: input.trim(),
        startNodeId: entryNodeId,
        channelType,
      });
      setResult(res);
      onResult(res, res.path);
    } catch {
      toast.error("Erro ao simular workflow");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Simular roteamento</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Mensagem de teste</Label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex: Quero saber o preco do produto premium"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Canal de origem</Label>
        <Select value={channelType} onValueChange={(v) => v && setChannelType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!entryNodeId && (
        <p className="text-xs text-destructive">
          Marque um no como "Entrada" no canvas para simular
        </p>
      )}

      <Button
        onClick={handleSimulate}
        disabled={!input.trim() || !entryNodeId || loading}
        size="sm"
      >
        <Play className="mr-2 h-4 w-4" />
        {loading ? "Simulando..." : "Simular"}
      </Button>

      {result && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Caminho percorrido
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {result.path.map((nodeId, i) => (
                  <span key={nodeId} className="flex items-center gap-1">
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      {nodeId}
                    </span>
                    {i < result.path.length - 1 && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                  </span>
                ))}
              </div>
            </div>

            {result.selectedAgent && (
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Agente selecionado
                </span>
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 dark:border-green-900 dark:bg-green-900/20">
                  <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-400">
                    {result.selectedAgent}
                  </span>
                </div>
              </div>
            )}

            {result.matchedCondition && (
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Condicao satisfeita
                </span>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        CONDITION_COLORS[result.matchedCondition.type as ConditionType],
                    }}
                  />
                  <strong>{CONDITION_LABELS[result.matchedCondition.type as ConditionType]}</strong>
                  {result.matchedCondition.value && (
                    <span className="ml-1 text-muted-foreground">
                      — {result.matchedCondition.value}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Raciocinio
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {result.reasoning}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tipos ──────────────────────────────────────────────────────────────

const nodeTypes = { agent: AgentNode };
const edgeTypes = { handoff: HandoffEdge };

// ─── Canvas interno (precisa estar dentro de ReactFlowProvider) ──────────

function WorkflowCanvas({ workflowId }: { workflowId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const { data: workflow, isLoading: wfLoading } = useQuery(workflowQueryOptions(workflowId));
  const { data: agents } = useQuery(agentsQueryOptions());

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);

  // Inicializar nos/arestas do workflow carregado
  useEffect(() => {
    if (!workflow || initialized) return;
    setInitialized(true);

    const flowNodes: Node[] = workflow.nodes.map((n) => ({
      id: n.id,
      type: "agent",
      position: n.position,
      data: { label: n.label, agentId: n.agentId, isEntry: n.isEntry },
    }));

    const flowEdges: Edge[] = workflow.edges.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      type: "handoff",
      data: { label: e.label, condition: e.condition, onSelect: handleEdgeSelect },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [workflow, initialized]);

  function handleEdgeSelect(edgeId: string) {
    const edge = edges.find((e) => e.id === edgeId);
    if (edge) {
      setSelectedEdge(edge);
      setSelectedNode(null);
    }
  }

  // Atualizar onSelect nas arestas quando edges mudam (para manter referencia atual)
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: { ...e.data, onSelect: handleEdgeSelect },
      })),
    );
  }, [edges.length]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: "handoff",
        data: {
          label: "Fallback",
          condition: { type: "fallback" },
          onSelect: handleEdgeSelect,
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
      // Abrir painel de edicao imediatamente
      setTimeout(() => {
        setSelectedEdge(newEdge);
        setSelectedNode(null);
      }, 50);
    },
    [setEdges],
  );

  // Drag-and-drop de agente da lista para o canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const agentId = event.dataTransfer.getData("application/xyflow-agent-id");
      const agentLabel = event.dataTransfer.getData("application/xyflow-agent-label");
      if (!agentId) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: "agent",
        position,
        data: { label: agentLabel || agentId, agentId, isEntry: false },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes],
  );

  function buildPayload() {
    const wfNodes: WorkflowNode[] = nodes.map((n) => {
      const d = n.data as unknown as AgentNodeData;
      return {
        id: n.id,
        agentId: d.agentId,
        label: d.label,
        position: n.position,
        isEntry: d.isEntry,
      };
    });

    const wfEdges: WorkflowEdge[] = edges.map((e) => {
      const d = e.data as HandoffEdgeData | undefined;
      return {
        id: e.id,
        from: e.source,
        to: e.target,
        label: d?.label ?? "",
        condition: d?.condition ?? { type: "fallback" },
      };
    });

    return { nodes: wfNodes, edges: wfEdges };
  }

  const saveMutation = useMutation({
    mutationFn: () => updateWorkflow(workflowId, buildPayload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Rascunho salvo");
    },
    onError: () => toast.error("Erro ao salvar rascunho"),
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      await updateWorkflow(workflowId, buildPayload());
      return applyWorkflow(workflowId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(`Workflow aplicado — ${result.agentsUpdated.length} agente(s) atualizados`);
      if (result.warnings.length > 0) {
        result.warnings.forEach((w) => toast.warning(w));
      }
    },
    onError: () => toast.error("Erro ao aplicar workflow"),
  });

  function handleEdgeUpdate(id: string, changes: Partial<{ label: string; condition: EdgeCondition }>) {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === id
          ? { ...e, data: { ...e.data, ...changes } }
          : e,
      ),
    );
    setSelectedEdge((prev) =>
      prev?.id === id ? { ...prev, data: { ...prev.data, ...changes } } : prev,
    );
  }

  function handleEdgeDelete(id: string) {
    setEdges((eds) => eds.filter((e) => e.id !== id));
    setSelectedEdge(null);
  }

  function handleNodeUpdate(id: string, changes: Partial<AgentNodeData>) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...changes } } : n,
      ),
    );
    setSelectedNode((prev) =>
      prev?.id === id ? { ...prev, data: { ...prev.data, ...changes } } : prev,
    );
  }

  function handleNodeDelete(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null);
  }

  function handleSimulationResult(_result: SimulateResult, path: string[]) {
    const pathSet = new Set(path);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, highlighted: pathSet.has(n.id) },
      })),
    );
  }

  function clearHighlights() {
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, highlighted: false } })),
    );
  }

  const entryNode = nodes.find((n) => (n.data as unknown as AgentNodeData).isEntry);

  if (wfLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Carregando workflow...
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <span>Workflow nao encontrado</span>
        <Button variant="ghost" onClick={() => navigate({ to: "/workflows" })}>
          Voltar
        </Button>
      </div>
    );
  }

  const hasRightPanel = !!selectedEdge || !!selectedNode || showSimulation;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b bg-card px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/workflows" })}
          className="mr-2"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Workflows
        </Button>
        <div className="flex-1">
          <span className="text-sm font-semibold">{workflow.label}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          Salvar rascunho
        </Button>
        <Button
          variant={showSimulation ? "secondary" : "outline"}
          size="sm"
          onClick={() => {
            setShowSimulation((v) => !v);
            if (showSimulation) clearHighlights();
            setSelectedEdge(null);
            setSelectedNode(null);
          }}
        >
          <Play className="mr-2 h-4 w-4" />
          Simular
        </Button>
        <Button
          size="sm"
          onClick={() => setConfirmApply(true)}
          disabled={applyMutation.isPending}
        >
          <Zap className="mr-2 h-4 w-4" />
          Aplicar ao vivo
        </Button>
      </div>

      {/* Corpo: 3 paineis */}
      <div className="flex flex-1 overflow-hidden">
        {/* Painel esquerdo: lista de agentes */}
        <div className="flex w-52 flex-col gap-2 overflow-y-auto border-r bg-muted/20 p-3">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Agentes disponíveis
          </span>
          <span className="text-[10px] text-muted-foreground">Arraste para o canvas</span>
          <Separator />
          {(agents ?? []).map((agent) => (
            <div
              key={agent.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/xyflow-agent-id", agent.id);
                e.dataTransfer.setData(
                  "application/xyflow-agent-label",
                  agent.slug ?? agent.id,
                );
                e.dataTransfer.effectAllowed = "move";
              }}
              className="flex cursor-grab items-center gap-2 rounded-lg border border-border bg-card px-2 py-2 text-sm transition-shadow hover:shadow-sm active:cursor-grabbing"
            >
              <Bot className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="truncate font-medium">{agent.slug}</div>
                <div className="truncate text-[10px] text-muted-foreground">{agent.owner}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Canvas React Flow */}
        <div className="flex-1 overflow-hidden" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={(_event, node) => {
              setSelectedNode(node);
              setSelectedEdge(null);
            }}
            onPaneClick={() => {
              setSelectedNode(null);
              setSelectedEdge(null);
            }}
            fitView
            deleteKeyCode="Delete"
            className="bg-background"
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {/* Painel direito: editor contextual ou simulacao */}
        {hasRightPanel && (
          <div className="w-72 shrink-0 overflow-y-auto border-l bg-card">
            {showSimulation && (
              <SimulationPanel
                workflowId={workflowId}
                entryNodeId={entryNode?.id ?? null}
                onClose={() => {
                  setShowSimulation(false);
                  clearHighlights();
                }}
                onResult={handleSimulationResult}
              />
            )}
            {!showSimulation && selectedEdge && (
              <EdgeEditorPanel
                edge={selectedEdge}
                onUpdate={handleEdgeUpdate}
                onDelete={handleEdgeDelete}
                onClose={() => setSelectedEdge(null)}
              />
            )}
            {!showSimulation && selectedNode && (
              <NodeEditorPanel
                node={selectedNode}
                onUpdate={handleNodeUpdate}
                onDelete={handleNodeDelete}
                onClose={() => setSelectedNode(null)}
              />
            )}
          </div>
        )}
      </div>

      {/* Modal de confirmacao de aplicar */}
      <AlertDialog open={confirmApply} onOpenChange={setConfirmApply}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar ao vivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso salvar&aacute; o rascunho e atualizar&aacute; o frontmatter{" "}
              <code>handoff</code> dos agentes participantes. Os agentes passar&atilde;o a
              rotear handoffs conforme as arestas configuradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmApply(false);
                applyMutation.mutate();
              }}
            >
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Pagina wrapper com provider ─────────────────────────────────────────

function WorkflowCanvasPage() {
  const { id } = Route.useParams();

  return (
    <div className="-m-4 h-[calc(100vh-4rem)] overflow-hidden">
      <ReactFlowProvider>
        <WorkflowCanvas workflowId={id} />
      </ReactFlowProvider>
    </div>
  );
}
