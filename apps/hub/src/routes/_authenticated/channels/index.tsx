import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/channels/")({
  staticData: { title: "Canais", description: "Canais de comunicação dos agentes" },
  component: () => null,
});
