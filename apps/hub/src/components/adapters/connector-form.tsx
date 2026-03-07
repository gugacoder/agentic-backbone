import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type ConnectorType = "mysql" | "postgres" | "evolution" | "twilio" | "http";

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
}

export function ConnectorForm({ connector, credential, maskedFields, onChange, onUnmask }: Props) {
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
