import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/conversations/new")({
  component: () => null,
});
