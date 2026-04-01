import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/adapters/")({
  staticData: { title: "Adaptadores", description: "Gerencie conectores de integração" },
  component: () => null,
});
