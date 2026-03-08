import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronRight, Play } from "lucide-react";
import { draftQueryOptions, compareDraft, type CompareResult } from "@/api/drafts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/agents/$id/drafts/$draftId/compare")({
  component: DraftComparePage,
});

function wordDiff(a: string, b: string): { production: React.ReactNode; draft: React.ReactNode } {
  const aWords = a.split(/(\s+)/);
  const bWords = b.split(/(\s+)/);

  const aSet = new Set(aWords.filter((w) => w.trim()));
  const bSet = new Set(bWords.filter((w) => w.trim()));

  const productionNodes = aWords.map((word, i) => {
    if (!word.trim()) return word;
    const missing = !bSet.has(word);
    return missing ? (
      <mark key={i} style={{ background: "var(--color-yellow-300, #fde047)", borderRadius: "2px" }}>
        {word}
      </mark>
    ) : (
      <span key={i}>{word}</span>
    );
  });

  const draftNodes = bWords.map((word, i) => {
    if (!word.trim()) return word;
    const added = !aSet.has(word);
    return added ? (
      <mark key={i} style={{ background: "var(--color-yellow-300, #fde047)", borderRadius: "2px" }}>
        {word}
      </mark>
    ) : (
      <span key={i}>{word}</span>
    );
  });

  return { production: <>{productionNodes}</>, draft: <>{draftNodes}</> };
}

function DraftComparePage() {
  const { id: agentId, draftId } = Route.useParams();
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);

  const { data: draft, isLoading } = useQuery(draftQueryOptions(agentId, draftId));

  const mutation = useMutation({
    mutationFn: () => compareDraft(agentId, draftId, message),
    onSuccess: (data) => setResult(data),
  });

  const diff = result ? wordDiff(result.production.text, result.draft.text) : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/agents" className="hover:text-foreground transition-colors">
          Agentes
        </Link>
        <ChevronRight className="size-3.5" />
        <Link
          to="/agents/$id"
          params={{ id: agentId }}
          search={{ tab: "sandbox" }}
          className="hover:text-foreground transition-colors"
        >
          {agentId}
        </Link>
        <ChevronRight className="size-3.5" />
        <Link
          to="/agents/$id/drafts/$draftId"
          params={{ id: agentId, draftId }}
          className="hover:text-foreground transition-colors"
        >
          {draft?.label ?? "Rascunho"}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground font-medium">Comparacao</span>
      </nav>

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          className="flex-1 min-h-[80px] font-mono text-sm p-3 border rounded-md bg-muted/20 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Digite uma mensagem de teste para comparar as respostas..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={mutation.isPending}
        />
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !message.trim()}
          className="self-start"
        >
          <Play className="size-4 mr-1" />
          {mutation.isPending ? "Executando..." : "Executar comparacao"}
        </Button>
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive">
          Erro ao executar comparacao. Tente novamente.
        </p>
      )}

      {/* Results */}
      {result && diff && (
        <div className="grid grid-cols-2 gap-4">
          {/* Production column */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b">
              <span className="text-sm font-semibold">Producao</span>
            </div>
            <div className="text-sm leading-relaxed p-3 border rounded-md bg-muted/10 min-h-[200px] whitespace-pre-wrap">
              {diff.production}
            </div>
          </div>

          {/* Draft column */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b">
              <span className="text-sm font-semibold">Rascunho</span>
              <span className="text-xs text-muted-foreground">{result.draft.label}</span>
            </div>
            <div className="text-sm leading-relaxed p-3 border rounded-md bg-muted/10 min-h-[200px] whitespace-pre-wrap">
              {diff.draft}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
