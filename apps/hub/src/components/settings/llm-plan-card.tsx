import { Check, Loader2 } from "lucide-react";
import type { LlmPlan } from "@/api/settings";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LlmPlanCardProps {
  slug: string;
  plan: LlmPlan;
  isActive: boolean;
  onActivate: (slug: string) => void;
  isLoading?: boolean;
}

const roleLabels: Record<string, string> = {
  conversation: "Conversa",
  heartbeat: "Heartbeat",
  memory: "Memoria",
};

function formatModelName(model: string) {
  const parts = model.split("/");
  return parts.length > 1 ? parts[1] : model;
}

function ThinkingBadge({ thinking }: { thinking: LlmPlan["thinking"] }) {
  if (!thinking) return <Badge variant="outline">Sem thinking</Badge>;

  switch (thinking.type) {
    case "adaptive":
      return <Badge variant="secondary">Adaptativo</Badge>;
    case "enabled":
      return (
        <Badge variant="secondary">
          Habilitado ({Math.round(thinking.budgetTokens / 1000)}K tokens)
        </Badge>
      );
    case "disabled":
      return <Badge variant="outline">Desabilitado</Badge>;
  }
}

function EffortBadge({ effort }: { effort?: LlmPlan["effort"] }) {
  if (!effort) return null;

  const variants: Record<string, "secondary" | "outline" | "default"> = {
    low: "outline",
    medium: "secondary",
    high: "default",
    max: "default",
  };

  const labels: Record<string, string> = {
    low: "Baixo",
    medium: "Medio",
    high: "Alto",
    max: "Maximo",
  };

  return <Badge variant={variants[effort]}>{labels[effort]}</Badge>;
}

export function LlmPlanCard({
  slug,
  plan,
  isActive,
  onActivate,
  isLoading,
}: LlmPlanCardProps) {
  return (
    <Card
      className={cn(
        "transition-colors",
        isActive && "ring-2 ring-primary",
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {plan.label}
          {isActive && <Badge variant="default">Ativo</Badge>}
        </CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        <CardAction>
          <div className="flex gap-1.5">
            <EffortBadge effort={plan.effort} />
            <ThinkingBadge thinking={plan.thinking} />
          </div>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Modelos por role
          </p>
          <div className="grid gap-1">
            {Object.entries(plan.profiles).map(([role, profile]) => (
              <div
                key={role}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">
                  {roleLabels[role] ?? role}
                </span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {formatModelName(profile.model)}
                </code>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          size="sm"
          variant={isActive ? "outline" : "default"}
          disabled={isActive || isLoading}
          onClick={() => onActivate(slug)}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isActive ? (
            <>
              <Check className="size-4" />
              Plano ativo
            </>
          ) : (
            "Ativar este plano"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
