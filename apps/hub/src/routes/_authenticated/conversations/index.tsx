import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/conversations/")({
  staticData: { title: "Conversas", description: "Histórico de conversas com agentes" },
  component: () => null,
});
