import { useRouter, Link } from "@tanstack/react-router";
import { ApiError } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";

function getErrorInfo(error: unknown): { title: string; description: string } {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 404:
        return {
          title: "Recurso não encontrado",
          description: "O item que você procura não existe ou foi removido.",
        };
      case 403:
        return {
          title: "Acesso negado",
          description: "Você não tem permissão para acessar este recurso.",
        };
      case 500:
        return {
          title: "Erro interno",
          description: "Ocorreu um erro no servidor. Tente novamente.",
        };
      default:
        return {
          title: `Erro ${error.status}`,
          description: "Ocorreu um erro ao carregar esta página.",
        };
    }
  }

  return {
    title: "Algo deu errado",
    description: "Ocorreu um erro inesperado ao carregar esta página.",
  };
}

export function RouteError({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  const router = useRouter();
  const { title, description } = getErrorInfo(error);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="space-y-4 text-center max-w-md">
        <p className="text-4xl font-bold text-muted-foreground">
          {error instanceof ApiError ? error.status : "Erro"}
        </p>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" onClick={() => router.history.back()}>
            Voltar
          </Button>
          <Button variant="outline" onClick={reset}>
            Tentar novamente
          </Button>
          <Link to="/" className={buttonVariants()}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
