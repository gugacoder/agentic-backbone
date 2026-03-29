import { generateText } from "ai";
/**
 * Try to fix tool name by case-insensitive matching against available tools.
 * Returns the correct name if found, or null.
 */
function fixToolName(toolName, tools) {
    if (toolName in tools)
        return toolName; // already correct
    const lower = toolName.toLowerCase();
    for (const name of Object.keys(tools)) {
        if (name.toLowerCase() === lower)
            return name;
    }
    return null;
}
/**
 * Cria um handler de reparo que pede ao modelo para corrigir a tool call.
 * Primeiro tenta corrigir o nome da tool (case mismatch), depois os args.
 * Tenta N vezes. Se todas falharem, retorna null (deixa o erro original propagar).
 */
export function createToolCallRepairHandler(ctx) {
    const attempts = new Map();
    return async (options) => {
        const { toolCall, tools, inputSchema, error } = options;
        // Fix tool name case mismatch (e.g. "Email_send" → "email_send")
        const correctedName = fixToolName(toolCall.toolName, tools);
        if (correctedName && correctedName !== toolCall.toolName) {
            return {
                type: "tool-call",
                toolCallId: toolCall.toolCallId,
                toolName: correctedName,
                input: toolCall.input,
            };
        }
        const key = `${toolCall.toolName}:${toolCall.input}`;
        const current = attempts.get(key) ?? 0;
        if (current >= ctx.maxAttempts) {
            return null; // desiste — erro original propaga
        }
        attempts.set(key, current + 1);
        // If tool name is completely wrong, can't repair args
        if (!correctedName)
            return null;
        try {
            const schema = await Promise.resolve(inputSchema({ toolName: toolCall.toolName }));
            const result = await generateText({
                model: ctx.model,
                system: [
                    "You generated an invalid tool call. Fix the JSON arguments to match the schema.",
                    "Return ONLY the corrected JSON object — no explanation, no markdown.",
                ].join("\n"),
                prompt: [
                    `Tool: ${toolCall.toolName}`,
                    `Schema: ${JSON.stringify(schema)}`,
                    `Invalid args: ${toolCall.input}`,
                    `Error: ${error.message}`,
                ].join("\n"),
                maxOutputTokens: 1000,
            });
            const repaired = (result.text ?? toolCall.input).trim();
            return {
                type: "tool-call",
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                input: repaired,
            };
        }
        catch {
            return null; // reparo falhou — erro original propaga
        }
    };
}
