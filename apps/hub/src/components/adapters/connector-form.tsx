import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type ConnectorType = "mysql" | "postgres" | "evolution" | "twilio" | "http" | "whatsapp-cloud" | "mcp";

// MCP-specific options (transport config, not credentials)
export interface McpOptions {
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  server_label?: string;
  allowed_tools?: string[];
}

export interface ConnectorCredential {
  // MySQL / Postgres
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  // Evolution
  url?: string;
  apiKey?: string;
  instance?: string;
  // Twilio
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
  // HTTP
  baseUrl?: string;
  headers?: string;
  bearerToken?: string;
  timeoutMs?: number;
  // WhatsApp Cloud
  access_token?: string;
  app_secret?: string;
  phone_number_id?: string;
  waba_id?: string;
  verify_token?: string;
  // MCP
  api_key?: string;
}

// Sentinel value used when a masked password is not changed
export const MASKED = "***";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  masked: boolean;
  onChange: (v: string) => void;
  onClear: () => void;
}

function PasswordField({ id, label, value, masked, onChange, onClear }: PasswordFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="password"
          value={masked ? MASKED : value}
          readOnly={masked}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
          placeholder={masked ? undefined : label}
        />
        {masked && (
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            Alterar
          </Button>
        )}
      </div>
    </div>
  );
}

interface Props {
  connector: ConnectorType;
  credential: ConnectorCredential;
  maskedFields: Set<string>;
  onChange: (cred: ConnectorCredential) => void;
  onUnmask: (field: string) => void;
  mcpOptions?: McpOptions;
  onMcpOptionsChange?: (opts: McpOptions) => void;
}

export function ConnectorForm({ connector, credential, maskedFields, onChange, onUnmask, mcpOptions, onMcpOptionsChange }: Props) {
  function set(key: keyof ConnectorCredential, value: string | number | boolean) {
    onChange({ ...credential, [key]: value });
  }

  function isMasked(field: string) {
    return maskedFields.has(field);
  }

  if (connector === "mysql" || connector === "postgres") {
    const defaultPort = connector === "mysql" ? 3306 : 5432;
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cf-host">Host</Label>
          <Input
            id="cf-host"
            value={credential.host ?? ""}
            onChange={(e) => set("host", e.target.value)}
            placeholder="localhost"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-port">Porta</Label>
          <Input
            id="cf-port"
            type="number"
            value={credential.port ?? defaultPort}
            onChange={(e) => set("port", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-user">Usuário</Label>
          <Input
            id="cf-user"
            value={credential.user ?? ""}
            onChange={(e) => set("user", e.target.value)}
            placeholder="root"
          />
        </div>
        <PasswordField
          id="cf-password"
          label="Senha"
          value={credential.password ?? ""}
          masked={isMasked("password")}
          onChange={(v) => set("password", v)}
          onClear={() => onUnmask("password")}
        />
        <div className="space-y-1.5">
          <Label htmlFor="cf-database">Banco de dados</Label>
          <Input
            id="cf-database"
            value={credential.database ?? ""}
            onChange={(e) => set("database", e.target.value)}
            placeholder="mydb"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="cf-ssl"
            checked={credential.ssl ?? false}
            onCheckedChange={(v) => set("ssl", v)}
          />
          <Label htmlFor="cf-ssl">SSL</Label>
        </div>
      </div>
    );
  }

  if (connector === "evolution") {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cf-url">URL da instância</Label>
          <Input
            id="cf-url"
            value={credential.url ?? ""}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://api.evolution.example.com"
          />
        </div>
        <PasswordField
          id="cf-apikey"
          label="API Key"
          value={credential.apiKey ?? ""}
          masked={isMasked("apiKey")}
          onChange={(v) => set("apiKey", v)}
          onClear={() => onUnmask("apiKey")}
        />
        <div className="space-y-1.5">
          <Label htmlFor="cf-instance">Nome da instância</Label>
          <Input
            id="cf-instance"
            value={credential.instance ?? ""}
            onChange={(e) => set("instance", e.target.value)}
            placeholder="minha-instancia"
          />
        </div>
      </div>
    );
  }

  if (connector === "twilio") {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cf-sid">Account SID</Label>
          <Input
            id="cf-sid"
            value={credential.accountSid ?? ""}
            onChange={(e) => set("accountSid", e.target.value)}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
        </div>
        <PasswordField
          id="cf-authtoken"
          label="Auth Token"
          value={credential.authToken ?? ""}
          masked={isMasked("authToken")}
          onChange={(v) => set("authToken", v)}
          onClear={() => onUnmask("authToken")}
        />
        <div className="space-y-1.5">
          <Label htmlFor="cf-phone">Número de telefone</Label>
          <Input
            id="cf-phone"
            value={credential.phoneNumber ?? ""}
            onChange={(e) => set("phoneNumber", e.target.value)}
            placeholder="+5511999999999"
          />
        </div>
      </div>
    );
  }

  if (connector === "whatsapp-cloud") {
    return (
      <div className="space-y-3">
        <PasswordField
          id="cf-access-token"
          label="Access Token"
          value={credential.access_token ?? ""}
          masked={isMasked("access_token")}
          onChange={(v) => set("access_token", v)}
          onClear={() => onUnmask("access_token")}
        />
        <PasswordField
          id="cf-app-secret"
          label="App Secret"
          value={credential.app_secret ?? ""}
          masked={isMasked("app_secret")}
          onChange={(v) => set("app_secret", v)}
          onClear={() => onUnmask("app_secret")}
        />
        <div className="space-y-1.5">
          <Label htmlFor="cf-phone-id">Phone Number ID</Label>
          <Input
            id="cf-phone-id"
            value={credential.phone_number_id ?? ""}
            onChange={(e) => set("phone_number_id", e.target.value)}
            placeholder="123456789"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-waba-id">WABA ID</Label>
          <Input
            id="cf-waba-id"
            value={credential.waba_id ?? ""}
            onChange={(e) => set("waba_id", e.target.value)}
            placeholder="123456789"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-verify-token">Verify Token</Label>
          <Input
            id="cf-verify-token"
            value={credential.verify_token ?? ""}
            onChange={(e) => set("verify_token", e.target.value)}
            placeholder="meu-token-secreto"
          />
        </div>
      </div>
    );
  }

  // HTTP
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cf-baseurl">URL base</Label>
        <Input
          id="cf-baseurl"
          value={credential.baseUrl ?? ""}
          onChange={(e) => set("baseUrl", e.target.value)}
          placeholder="https://api.example.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-headers">Headers JSON</Label>
        <Textarea
          id="cf-headers"
          value={credential.headers ?? ""}
          onChange={(e) => set("headers", e.target.value)}
          placeholder='{"Content-Type": "application/json"}'
          rows={3}
          className="font-mono text-xs"
        />
      </div>
      <PasswordField
        id="cf-bearer"
        label="Auth Bearer Token"
        value={credential.bearerToken ?? ""}
        masked={isMasked("bearerToken")}
        onChange={(v) => set("bearerToken", v)}
        onClear={() => onUnmask("bearerToken")}
      />
      <div className="space-y-1.5">
        <Label htmlFor="cf-timeout">Timeout (ms)</Label>
        <Input
          id="cf-timeout"
          type="number"
          value={credential.timeoutMs ?? 5000}
          onChange={(e) => set("timeoutMs", Number(e.target.value))}
        />
      </div>
    </div>
  );
}

// ---- MCP Sub-components ----

function McpEnvEditor({
  env,
  onChange,
}: {
  env: Record<string, string>;
  onChange: (env: Record<string, string>) => void;
}) {
  const entries = Object.entries(env);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  function addEntry() {
    if (!newKey.trim()) return;
    onChange({ ...env, [newKey.trim()]: newVal });
    setNewKey("");
    setNewVal("");
  }

  function removeEntry(key: string) {
    const next = { ...env };
    delete next[key];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2 items-center">
          <Input value={k} readOnly className="font-mono text-xs flex-1" />
          <Input value={v} readOnly className="font-mono text-xs flex-1" />
          <Button type="button" variant="ghost" size="icon" onClick={() => removeEntry(k)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2 items-center">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="CHAVE"
          className="font-mono text-xs flex-1"
        />
        <Input
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          placeholder="valor"
          className="font-mono text-xs flex-1"
        />
        <Button type="button" variant="outline" size="icon" onClick={addEntry}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function McpArgsEditor({
  args,
  onChange,
}: {
  args: string[];
  onChange: (args: string[]) => void;
}) {
  const [newArg, setNewArg] = useState("");

  function addArg() {
    if (!newArg.trim()) return;
    onChange([...args, newArg.trim()]);
    setNewArg("");
  }

  function removeArg(i: number) {
    onChange(args.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {args.map((a, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input value={a} readOnly className="font-mono text-xs flex-1" />
          <Button type="button" variant="ghost" size="icon" onClick={() => removeArg(i)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2 items-center">
        <Input
          value={newArg}
          onChange={(e) => setNewArg(e.target.value)}
          placeholder="argumento"
          className="font-mono text-xs flex-1"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addArg())}
        />
        <Button type="button" variant="outline" size="icon" onClick={addArg}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function McpConnectorForm({
  credential,
  maskedFields,
  onChange,
  onUnmask,
  options,
  onOptionsChange,
}: {
  credential: ConnectorCredential;
  maskedFields: Set<string>;
  onChange: (cred: ConnectorCredential) => void;
  onUnmask: (field: string) => void;
  options: McpOptions;
  onOptionsChange: (opts: McpOptions) => void;
}) {
  function isMasked(field: string) {
    return maskedFields.has(field);
  }

  function setOpt<K extends keyof McpOptions>(key: K, value: McpOptions[K]) {
    onOptionsChange({ ...options, [key]: value });
  }

  const transport = options.transport ?? "stdio";

  return (
    <div className="space-y-4">
      {/* Transport */}
      <div className="space-y-1.5">
        <Label>Transporte</Label>
        <Select
          value={transport}
          onValueChange={(v) => setOpt("transport", v as "stdio" | "http")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stdio">stdio (processo local)</SelectItem>
            <SelectItem value="http">HTTP / SSE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Server label */}
      <div className="space-y-1.5">
        <Label htmlFor="mcp-label">Nome do servidor</Label>
        <Input
          id="mcp-label"
          value={options.server_label ?? ""}
          onChange={(e) => setOpt("server_label", e.target.value)}
          placeholder="GitHub MCP"
        />
      </div>

      {transport === "stdio" ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-command">Comando</Label>
            <Input
              id="mcp-command"
              value={options.command ?? ""}
              onChange={(e) => setOpt("command", e.target.value)}
              placeholder="npx"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Argumentos</Label>
            <McpArgsEditor
              args={options.args ?? []}
              onChange={(a) => setOpt("args", a)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Variáveis de ambiente</Label>
            <McpEnvEditor
              env={options.env ?? {}}
              onChange={(e) => setOpt("env", e)}
            />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-url">URL do servidor MCP</Label>
            <Input
              id="mcp-url"
              value={options.url ?? ""}
              onChange={(e) => setOpt("url", e.target.value)}
              placeholder="https://mcp.example.com/sse"
            />
          </div>
          <PasswordField
            id="mcp-apikey"
            label="API Key (opcional)"
            value={credential.api_key ?? ""}
            masked={isMasked("api_key")}
            onChange={(v) => onChange({ ...credential, api_key: v })}
            onClear={() => onUnmask("api_key")}
          />
        </>
      )}
    </div>
  );
}
