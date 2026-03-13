import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, MessageSquare, Heart, Sparkles, Wrench, Shield, GitBranch, Plus, Pencil, Trash2, ChevronLeft, Check, Loader2, AlertCircle } from "lucide-react";
import { agentFileQueryOptions, saveAgentFile } from "@/api/agents";
import type { Agent } from "@/api/agents";
import {
  agentSkillsQueryOptions,
  createSkill,
  updateSkill,
  deleteSkill,
  allServicesQueryOptions,
  agentServicesQueryOptions,
  assignService,
  unassignService,
} from "@/api/skills";
import type { Skill } from "@/api/skills";
import { MarkdownEditor } from "@/components/shared/markdown-editor";
import { HeartbeatConfig } from "@/components/agents/heartbeat-config";
import { AgentAdvancedPanel } from "@/components/agents/agent-advanced-panel";
import { AgentRoutingSettings } from "@/components/routing/agent-routing-settings";
import { ResourceAssigner } from "@/components/shared/resource-assigner";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const subtabs = [
  { value: "identity", label: "Identidade", icon: FileText, kind: "file" as const, filename: "SOUL.md" },
  { value: "conversation", label: "Conversa", icon: MessageSquare, kind: "file" as const, filename: "CONVERSATION.md" },
  { value: "heartbeat", label: "Heartbeat", icon: Heart, kind: "file" as const, filename: "HEARTBEAT.md" },
  { value: "skills", label: "Skills", icon: Sparkles, kind: "resource" as const },
  { value: "tools", label: "Tools", icon: Wrench, kind: "resource" as const, disabled: true },
  { value: "routing", label: "Routing", icon: GitBranch, kind: "routing" as const },
  { value: "advanced", label: "Avancado", icon: Shield, kind: "advanced" as const },
] as const;

type SubtabValue = (typeof subtabs)[number]["value"];

interface AgentConfigTabsProps {
  agentId: string;
  agent: Agent;
  subtab?: string;
}

export function AgentConfigTabs({ agentId, agent, subtab }: AgentConfigTabsProps) {
  const navigate = useNavigate();
  const activeSubtab = (
    subtabs.some((s) => s.value === subtab && !("disabled" in s && s.disabled)) ? subtab : "identity"
  ) as SubtabValue;

  const activeConfig = subtabs.find((s) => s.value === activeSubtab)!;

  function handleSubtabChange(value: SubtabValue) {
    navigate({
      to: "/agents/$id/config",
      params: { id: agentId },
      search: { subtab: value },
      replace: true,
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {/* Vertical sub-tab navigation */}
      <nav className="flex flex-row gap-1 sm:w-48 sm:flex-col sm:border-r sm:pr-4">
        {subtabs.map((s) => (
          <button
            key={s.value}
            onClick={() => !("disabled" in s && s.disabled) && handleSubtabChange(s.value)}
            disabled={"disabled" in s && s.disabled}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left",
              "disabled" in s && s.disabled
                ? "opacity-40 cursor-not-allowed"
                : activeSubtab === s.value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <s.icon className="size-4 shrink-0" />
            {s.label}
          </button>
        ))}
      </nav>

      {/* Content area */}
      <div className="flex-1 min-w-0 space-y-6">
        {activeConfig.kind === "file" && (
          <>
            <FileEditor
              key={`${agentId}-${activeConfig.filename}`}
              agentId={agentId}
              filename={activeConfig.filename}
            />
            {activeSubtab === "heartbeat" && (
              <>
                <Separator />
                <HeartbeatConfig agentId={agentId} />
              </>
            )}
          </>
        )}
        {activeSubtab === "skills" && (
          <SkillsPanel agentId={agentId} />
        )}
        {activeSubtab === "tools" && (
          <ToolsPanel agentId={agentId} />
        )}
        {activeSubtab === "routing" && (
          <AgentRoutingSettings agentId={agentId} />
        )}
        {activeSubtab === "advanced" && (
          <AgentAdvancedPanel agent={agent} />
        )}
      </div>
    </div>
  );
}

function FileEditor({ agentId, filename }: { agentId: string; filename: string }) {
  const { data, isLoading, isError } = useQuery(agentFileQueryOptions(agentId, filename));

  const [content, setContent] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isPreview, setIsPreview] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeNoteRef = useRef(changeNote);

  useEffect(() => {
    changeNoteRef.current = changeNote;
  }, [changeNote]);

  // Sync fetched content to local state once
  useEffect(() => {
    if (data) {
      setContent(data.content);
    } else if (isError) {
      // File doesn't exist yet — start empty
      setContent("");
    }
  }, [data, isError]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedRef.current) clearTimeout(savedRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      setSaveStatus("idle");

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedRef.current) clearTimeout(savedRef.current);

      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await saveAgentFile(agentId, filename, value, changeNoteRef.current || undefined);
          setSaveStatus("saved");
          savedRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
        } catch {
          setSaveStatus("error");
        }
      }, 2000);
    },
    [agentId, filename],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <MarkdownEditor
        value={content ?? ""}
        onChange={handleChange}
        saveStatus={saveStatus}
        placeholder={`Escreva o conteudo de ${filename}...`}
        onPreviewChange={setIsPreview}
      />
      {!isPreview && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            Nota sobre esta mudanca (opcional)
          </label>
          <input
            type="text"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="Ex: Ajuste no tom de comunicacao"
            className="h-8 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}
    </div>
  );
}

/** source from the API can be "agent:agentId", "user:owner", "shared" — strip prefix for CRUD scope */
function sourceToScope(source: string): string {
  const colonIdx = source.indexOf(":");
  return colonIdx >= 0 ? source.slice(colonIdx + 1) : source;
}

type SkillView = { mode: "list" } | { mode: "edit"; skill: Skill } | { mode: "create" };

function SkillsPanel({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<SkillView>({ mode: "list" });
  const { data: skills, isLoading } = useQuery(agentSkillsQueryOptions(agentId));

  const deleteMutation = useMutation({
    mutationFn: (skill: Skill) => deleteSkill(sourceToScope(skill.source), skill.slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "skills"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (view.mode === "create") {
    return (
      <SkillEditor
        agentId={agentId}
        onBack={() => setView({ mode: "list" })}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["agents", agentId, "skills"] });
          setView({ mode: "list" });
        }}
      />
    );
  }

  if (view.mode === "edit") {
    return (
      <SkillEditor
        agentId={agentId}
        skill={view.skill}
        onBack={() => setView({ mode: "list" })}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["agents", agentId, "skills"] });
          setView({ mode: "list" });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {skills?.length ?? 0} skill{(skills?.length ?? 0) !== 1 ? "s" : ""} configurada{(skills?.length ?? 0) !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={() => setView({ mode: "create" })}>
          <Plus className="size-3.5 mr-1" />
          Nova skill
        </Button>
      </div>

      {!skills?.length ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma skill configurada. Crie uma nova skill para começar.
        </div>
      ) : (
        <div className="divide-y rounded-md border">
          {skills.map((skill) => (
            <div key={skill.slug} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{skill.name}</span>
                  {!skill.enabled && (
                    <Badge variant="outline" className="text-xs shrink-0">desativada</Badge>
                  )}
                  {skill.userInvocable && (
                    <Badge variant="secondary" className="text-xs shrink-0">/{skill.trigger ?? skill.slug}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">— {skill.source}</span>
                </div>
                {skill.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{skill.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setView({ mode: "edit", skill })}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(skill)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SkillEditorProps {
  agentId: string;
  skill?: Skill;
  onBack: () => void;
  onSaved: () => void;
}

function SkillEditor({ agentId, skill, onBack, onSaved }: SkillEditorProps) {
  const isCreate = !skill;

  const [slug, setSlug] = useState(skill?.slug ?? "");
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [enabled, setEnabled] = useState(skill?.enabled ?? true);
  const [userInvocable, setUserInvocable] = useState(skill?.userInvocable ?? false);
  const [trigger, setTrigger] = useState(skill?.trigger ?? "");
  const [body, setBody] = useState(skill?.body ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedRef.current) clearTimeout(savedRef.current);
    };
  }, []);

  const doSave = useCallback(
    async (bodyValue: string) => {
      setSaveStatus("saving");
      try {
        const metadata: Record<string, unknown> = {
          enabled,
          "user-invocable": userInvocable || undefined,
          trigger: userInvocable && trigger ? trigger : undefined,
        };
        if (isCreate) {
          await createSkill({
            slug,
            scope: agentId,
            name,
            description,
            body: bodyValue,
            metadata,
          });
          setSaveStatus("saved");
          savedRef.current = setTimeout(() => {
            setSaveStatus("idle");
            onSaved();
          }, 800);
        } else {
          await updateSkill(sourceToScope(skill.source), skill.slug, {
            name,
            description,
            body: bodyValue,
            metadata,
          });
          setSaveStatus("saved");
          savedRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
        }
      } catch {
        setSaveStatus("error");
      }
    },
    [isCreate, slug, name, description, enabled, userInvocable, trigger, agentId, skill, onSaved],
  );

  const handleBodyChange = useCallback(
    (value: string) => {
      setBody(value);
      setSaveStatus("idle");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedRef.current) clearTimeout(savedRef.current);
      if (!isCreate) {
        debounceRef.current = setTimeout(() => doSave(value), 2000);
      }
    },
    [isCreate, doSave],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="size-4" />
          Voltar
        </Button>
        <span className="text-sm text-muted-foreground">
          {isCreate ? "Nova skill" : `Editando: ${skill.name}`}
        </span>
        {!isCreate && (
          <div className="ml-auto">
            <SaveStatusBadge status={saveStatus} />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {isCreate && (
          <div className="space-y-1">
            <Label htmlFor="skill-slug">Slug</Label>
            <Input
              id="skill-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="minha-skill"
            />
            <p className="text-xs text-muted-foreground">Identificador único, sem espaços</p>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="skill-name">Nome</Label>
          <Input
            id="skill-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da skill"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="skill-description">Descrição</Label>
          <Input
            id="skill-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Breve descrição"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Switch id="skill-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="skill-enabled">Habilitada</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="skill-user-invocable" checked={userInvocable} onCheckedChange={setUserInvocable} />
          <Label htmlFor="skill-user-invocable">Invocável pelo usuário</Label>
        </div>
        {userInvocable && (
          <div className="flex items-center gap-2">
            <Label htmlFor="skill-trigger" className="shrink-0">Trigger</Label>
            <Input
              id="skill-trigger"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="nome-do-comando"
              className="h-8 w-40"
            />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label>Conteúdo</Label>
        <MarkdownEditor
          value={body}
          onChange={handleBodyChange}
          saveStatus={isCreate ? "idle" : saveStatus}
          placeholder="Escreva o conteúdo da skill em markdown..."
          minHeight={300}
        />
      </div>

      {isCreate && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onBack}>Cancelar</Button>
          <Button
            onClick={() => doSave(body)}
            disabled={!slug || !name || saveStatus === "saving"}
          >
            {saveStatus === "saving" && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
            Criar skill
          </Button>
        </div>
      )}
    </div>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {status === "saving" && <><Loader2 className="size-3 animate-spin" />Salvando...</>}
      {status === "saved" && <><Check className="size-3 text-green-600" />Salvo</>}
      {status === "error" && <><AlertCircle className="size-3 text-destructive" />Erro ao salvar</>}
    </span>
  );
}

function ToolsPanel({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const { data: allServices, isLoading: loadingAll } = useQuery(allServicesQueryOptions());
  const { data: agentServices, isLoading: loadingAgent } = useQuery(agentServicesQueryOptions(agentId));

  const assignMutation = useMutation({
    mutationFn: ({ slug, sourceScope }: { slug: string; sourceScope: string }) =>
      assignService(agentId, slug, sourceScope),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "services"] });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (slug: string) => unassignService(agentId, slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "services"] });
    },
  });

  return (
    <ResourceAssigner
      available={allServices ?? []}
      assigned={agentServices ?? []}
      onAssign={(slug, sourceScope) => assignMutation.mutate({ slug, sourceScope })}
      onUnassign={(slug) => unassignMutation.mutate(slug)}
      loading={loadingAll || loadingAgent}
    />
  );
}
