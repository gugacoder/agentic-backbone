import { Badge } from "@/components/ui/badge";

interface KbFrontmatterProps {
  data: Record<string, unknown>;
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">vazio</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground italic">[]</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, i) => (
          <Badge key={i} variant="secondary" className="font-mono text-[11px]">
            {String(item)}
          </Badge>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <pre className="text-[11px] bg-muted rounded px-2 py-1 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  if (typeof value === "boolean") {
    return (
      <Badge variant={value ? "default" : "outline"} className="text-[11px]">
        {value ? "true" : "false"}
      </Badge>
    );
  }
  return <span className="font-mono text-[12px]">{String(value)}</span>;
}

export function KbFrontmatter({ data }: KbFrontmatterProps) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
        Frontmatter
      </p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="font-mono text-[12px] text-muted-foreground">
              {key}
            </dt>
            <dd className="min-w-0 break-words">{renderValue(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
