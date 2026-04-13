/**
 * Configuration for spawning a sub-agent via the Task tool.
 * Inherits model/apiKey from the parent agent.
 */
export interface TaskConfig {
    model: string;
    apiKey: string;
    /** Maximum steps the sub-agent can take (default: 10) */
    maxSubSteps?: number;
}
/**
 * Factory that creates the Task tool for launching sub-agents.
 *
 * If no config is provided, returns a tool that explains it's not configured.
 * When configured, uses runAiAgent() internally to spawn an isolated sub-agent
 * that inherits the parent's model and apiKey but has no access to conversation history.
 */
export declare function createTaskTool(config?: TaskConfig): any;
