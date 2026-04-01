import { createFileRoute } from "@tanstack/react-router";
import { McpToolsTab } from "@/components/mcp/mcp-tools-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/mcp-tools")({
  staticData: { title: "MCP Tools", description: "Ferramentas MCP disponíveis" },
  component: AgentMcpToolsPage,
});

function AgentMcpToolsPage() {
  const { id } = Route.useParams();
  return <McpToolsTab agentId={id} />;
}
