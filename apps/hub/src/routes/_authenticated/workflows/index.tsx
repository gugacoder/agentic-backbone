import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/workflows/")({
  staticData: { title: "Workflows", description: "Orquestração visual de agentes" },
  component: () => null,
});
