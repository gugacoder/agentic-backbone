import { useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConnectorForm, MASKED } from "@/components/adapters/connector-form";
import type { ConnectorType, ConnectorCredential } from "@/components/adapters/connector-form";
import { request } from "@/lib/api";
import type { Adapter } from "@/api/adapters";

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Detect which credential fields are masked (value === "***")
function detectMaskedFields(credential: Record<string, unknown>): Set<string> {
  const masked = new Set<string>();
  for (const [key, value] of Object.entries(credential)) {
    if (value === MASKED) masked.add(key);
  }
  return masked;
}

// Build credential object to send, omitting masked (unchanged) fields
function buildCredentialPayload(
  credential: ConnectorCredential,
  maskedFields: Set<string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(credential)) {
    if (!maskedFields.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

type TestState = "idle" | "loading" | "ok" | "error";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAdapter?: Adapter | null;
}

export function AdapterDialog({ open, onOpenChange, editingAdapter }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!(editingAdapter?.slug);

  const [connector, setConnector] = useState<ConnectorType>("mysql");
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [scope, setScope] = useState<"shared" | "system">("shared");
  const [policy, setPolicy] = useState<"readonly" | "readwrite">("readwrite");
  const [credential, setCredential] = useState<ConnectorCredential>({});
  const [maskedFields, setMaskedFields] = useState<Set<string>>(new Set());

  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState("");
  const [testOk, setTestOk] = useState(false);

  // Reset form when opening / changing editing target
  useEffect(() => {
    if (!open) return;
    if (isEditing && editingAdapter) {
      setConnector((editingAdapter.connector as ConnectorType) ?? "mysql");
      setLabel(editingAdapter.name ?? "");
      setSlug(editingAdapter.slug ?? "");
      setSlugEdited(true);
      setScope((editingAdapter.source as "shared" | "system") ?? "shared");
      setPolicy((editingAdapter.policy as "readonly" | "readwrite") ?? "readwrite");
      const cred = (editingAdapter.credential ?? {}) as Record<string, unknown>;
      setCredential(cred as ConnectorCredential);
      setMaskedFields(detectMaskedFields(cred));
    } else {
      setConnector("mysql");
      setLabel("");
      setSlug("");
      setSlugEdited(false);
      setScope("shared");
      setPolicy("readwrite");
      setCredential({});
      setMaskedFields(new Set());
    }
    setTestState("idle");
    setTestError("");
    setTestOk(false);
  }, [open, isEditing, editingAdapter]);

  // Auto-generate slug from label
  function handleLabelChange(value: string) {
    setLabel(value);
    if (!slugEdited) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugEdited(true);
  }

  function handleConnectorChange(value: ConnectorType) {
    setConnector(value);
    setCredential({});
    setMaskedFields(new Set());
    setTestState("idle");
    setTestOk(false);
  }

  function handleUnmask(field: string) {
    const next = new Set(maskedFields);
    next.delete(field);
    setMaskedFields(next);
    // Clear the field value so user types fresh
    setCredential((prev: ConnectorCredential) => ({ ...prev, [field]: "" }));
  }

  async function handleTest() {
    setTestState("loading");
    setTestError("");
    try {
      // If creating new adapter, create it temporarily then test, or just POST test with current data
      // The spec says: POST /adapters/:slug/test — adapter must exist.
      // For new adapters, we save first then test.
      if (!isEditing) {
        await saveMutation.mutateAsync(false);
      }
      const result = await request<{ ok: boolean; latencyMs?: number; message?: string; error?: string }>(
        `/adapters/${slug}/test`,
        { method: "POST" },
      );
      if (result.ok) {
        setTestState("ok");
        setTestOk(true);
      } else {
        setTestState("error");
        setTestError(result.error ?? "Falha na conexao");
        setTestOk(false);
      }
    } catch (e) {
      setTestState("error");
      setTestError(e instanceof Error ? e.message : "Erro ao testar conexao");
      setTestOk(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (closeAfter: boolean) => {
      const credPayload = buildCredentialPayload(credential, maskedFields);
      if (isEditing) {
        await request(`/adapters/${editingAdapter!.slug}`, {
          method: "PATCH",
          body: JSON.stringify({ label, slug, scope, policy, credential: credPayload }),
        });
      } else {
        await request("/adapters", {
          method: "POST",
          body: JSON.stringify({ slug, connector, label, scope, policy, credential: credPayload, options: {} }),
        });
      }
      if (closeAfter) {
        queryClient.invalidateQueries({ queryKey: ["adapters"] });
        toast.success(isEditing ? "Adaptador atualizado" : "Adaptador criado");
        onOpenChange(false);
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar adaptador");
    },
  });

  async function handleSave() {
    await saveMutation.mutateAsync(true);
  }

  const canSave = isEditing || testOk;
  const isBusy = saveMutation.isPending || testState === "loading";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>{isEditing ? "Editar Adaptador" : "Novo Adaptador"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Connector */}
          <div className="space-y-1.5">
            <Label>Conector</Label>
            <Select
              value={connector}
              onValueChange={(v) => handleConnectorChange(v as ConnectorType)}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="postgres">Postgres</SelectItem>
                <SelectItem value="evolution">Evolution</SelectItem>
                <SelectItem value="twilio">Twilio</SelectItem>
                <SelectItem value="http">HTTP</SelectItem>
                <SelectItem value="whatsapp-cloud">WhatsApp Cloud</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <Label htmlFor="ad-label">Nome</Label>
            <Input
              id="ad-label"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="CRM MySQL"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="ad-slug">Slug</Label>
            <Input
              id="ad-slug"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="crm-mysql"
              className="font-mono text-sm"
            />
          </div>

          {/* Scope */}
          <div className="space-y-1.5">
            <Label>Escopo</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "shared" | "system")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shared">Compartilhado (shared)</SelectItem>
                <SelectItem value="system">Sistema (system)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Policy */}
          <div className="space-y-1.5">
            <Label>Política</Label>
            <Select value={policy} onValueChange={(v) => setPolicy(v as "readonly" | "readwrite")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="readwrite">Leitura e escrita</SelectItem>
                <SelectItem value="readonly">Somente leitura</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic connector fields */}
          <div className="border-t pt-4 space-y-1">
            <p className="text-sm font-medium mb-3">Credenciais</p>
            <ConnectorForm
              connector={connector}
              credential={credential}
              maskedFields={maskedFields}
              onChange={setCredential}
              onUnmask={handleUnmask}
            />
          </div>

          {/* Test connection */}
          <div className="border-t pt-4 space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isBusy || !slug}
              className="w-full"
            >
              {testState === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {testState === "ok" && <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />}
              {testState === "error" && <XCircle className="mr-2 h-4 w-4 text-destructive" />}
              {testState === "loading" ? "Testando..." : "Testar conexão"}
            </Button>
            {testState === "ok" && (
              <p className="text-xs text-green-600 text-center">Conexão bem-sucedida</p>
            )}
            {testState === "error" && testError && (
              <p className="text-xs text-destructive text-center">{testError}</p>
            )}
          </div>
        </div>

        <SheetFooter className="p-6 pt-4 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isBusy || !slug || !label}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
