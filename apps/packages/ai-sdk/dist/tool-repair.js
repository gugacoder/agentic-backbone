import { generateText } from "ai";
/**
 * Try to fix tool name by case-insensitive matching against available tools.
 * Returns the correct name if found, or null.
 */
function fixToolName(toolName, tools) {
    if (toolName in tools) return toolName;
    const lower = toolName.toLowerCase();
    for (const name of Object.keys(tools)) {
        if (name.toLowerCase() === lower) return name;
    }
    return null;
}
/**
 * Cria um handler de reparo que pede ao modelo para corrigir a tool call.
 * Primeiro tenta corrigir o nome da tool (case mismatch), depois os args.
 * Tenta N vezes. Se todas falharem, retorna null (deixa o erro original propaga).
 */
export function createToolCallRepairHandler(ctx) {
    const attempts = new Map();
    return async ({ toolCall, tools, parameterSchema, error, }) => {
        // Fix tool name case mismatch (e.g. "Email_send" → "email_send")
        const correctedName = fixToolName(toolCall.toolName, tools);
        if (correctedName && correctedName !== toolCall.toolName) {
            return {
                toolCallType: toolCall.toolCallType,
                toolCallId: toolCall.toolCallId,
                toolName: correctedName,
                args: toolCall.args,
            };
        }
        const key = `${toolCall.toolName}:${toolCall.args}`;
        const current = attempts.get(key) ?? 0;
        if (current >= ctx.maxAttempts) {
            return null;
        }
        attempts.set(key, current + 1);
        if (!correctedName) return null;
        try {
            const schema = parameterSchema({ toolName: toolCall.toolName });
            const result = await generateText({
                model: ctx.model,
                system: [
                    "You generated an invalid tool call. Fix the JSON arguments to match the schema.",
                    "Return ONLY the corrected JSON object — no explanation, no markdown.",
                ].join("\n"),
                prompt: [
                    `Tool: ${toolCall.toolName}`,
                    `Schema: ${JSON.stringify(schema)}`,
                    `Invalid args: ${toolCall.args}`,
                    `Error: ${error.message}`,
                ].join("\n"),
                maxOutputTokens: 1000,
            });
            const repaired = (result.text ?? toolCall.args).trim();
            return {
                toolCallType: toolCall.toolCallType,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                args: repaired,
            };
        }
        catch {
            return null;
        }
    };
}
