export { createBashTool } from "./bash.js";
export { createWriteTool } from "./write.js";
export { createEditTool } from "./edit.js";
export { createMultiEditTool } from "./multi-edit.js";
export { createApplyPatchTool } from "./apply-patch.js";
export declare const codingTools: {
    Read: import("ai").Tool<{
        file_path: string;
        offset?: number | undefined;
        limit?: number | undefined;
    }, string>;
    Write: ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            content: string;
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                content: string;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            content: string;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                content: string;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                content: string;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type?: undefined | "function";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            content: string;
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                content: string;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            content: string;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                content: string;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                content: string;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "dynamic";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            content: string;
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                content: string;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            content: string;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                content: string;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                content: string;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        supportsDeferredResults?: boolean;
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            content: string;
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                content: string;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            content: string;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                content: string;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            file_path: string;
            content: string;
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                content: string;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type?: undefined | "function";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            content: string;
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                content: string;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            content: string;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                content: string;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            file_path: string;
            content: string;
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                content: string;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "dynamic";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            content: string;
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                content: string;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            content: string;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                content: string;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            file_path: string;
            content: string;
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                content: string;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        supportsDeferredResults?: boolean;
    });
    Edit: ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type?: undefined | "function";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "dynamic";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        supportsDeferredResults?: boolean;
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type?: undefined | "function";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "dynamic";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            file_path: string;
            old_string: string;
            new_string: string;
            replace_all: boolean;
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                old_string: string;
                new_string: string;
                replace_all: boolean;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        supportsDeferredResults?: boolean;
    });
    Bash: ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            command: string;
            timeout?: number | undefined;
        }>;
        inputExamples?: {
            input: NoInfer<{
                command: string;
                timeout?: number | undefined;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            command: string;
            timeout?: number | undefined;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                command: string;
                timeout?: number | undefined;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                command: string;
                timeout?: number | undefined;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type?: undefined | "function";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            command: string;
            timeout?: number | undefined;
        }>;
        inputExamples?: {
            input: NoInfer<{
                command: string;
                timeout?: number | undefined;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            command: string;
            timeout?: number | undefined;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                command: string;
                timeout?: number | undefined;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                command: string;
                timeout?: number | undefined;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "dynamic";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            command: string;
            timeout?: number | undefined;
        }>;
        inputExamples?: {
            input: NoInfer<{
                command: string;
                timeout?: number | undefined;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            command: string;
            timeout?: number | undefined;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                command: string;
                timeout?: number | undefined;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                command: string;
                timeout?: number | undefined;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        supportsDeferredResults?: boolean;
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            command: string;
            timeout?: number | undefined;
        }>;
        inputExamples?: {
            input: NoInfer<{
                command: string;
                timeout?: number | undefined;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            command: string;
            timeout?: number | undefined;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                command: string;
                timeout?: number | undefined;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            command: string;
            timeout?: number | undefined;
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                command: string;
                timeout?: number | undefined;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type?: undefined | "function";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            command: string;
            timeout?: number | undefined;
        }>;
        inputExamples?: {
            input: NoInfer<{
                command: string;
                timeout?: number | undefined;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            command: string;
            timeout?: number | undefined;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                command: string;
                timeout?: number | undefined;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            command: string;
            timeout?: number | undefined;
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                command: string;
                timeout?: number | undefined;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "dynamic";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            command: string;
            timeout?: number | undefined;
        }>;
        inputExamples?: {
            input: NoInfer<{
                command: string;
                timeout?: number | undefined;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            command: string;
            timeout?: number | undefined;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                command: string;
                timeout?: number | undefined;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            command: string;
            timeout?: number | undefined;
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                command: string;
                timeout?: number | undefined;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        supportsDeferredResults?: boolean;
    });
    Glob: import("ai").Tool<{
        pattern: string;
        path?: string | undefined;
    }, string>;
    Grep: import("ai").Tool<{
        pattern: string;
        output_mode: "content" | "files_with_matches" | "count";
        path?: string | undefined;
        glob?: string | undefined;
    }, string>;
    ListDir: import("ai").Tool<{
        path: string;
        depth: number;
        ignore: string[];
    }, string>;
    MultiEdit: ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type?: undefined | "function";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "dynamic";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        supportsDeferredResults?: boolean;
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type?: undefined | "function";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "dynamic";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }>;
        inputExamples?: {
            input: NoInfer<{
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            file_path: string;
            edits: {
                old_string: string;
                new_string: string;
                replace_all: boolean;
            }[];
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                file_path: string;
                edits: {
                    old_string: string;
                    new_string: string;
                    replace_all: boolean;
                }[];
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        supportsDeferredResults?: boolean;
    });
    TodoWrite: import("ai").Tool<{
        todos: {
            status: "pending" | "in_progress" | "completed";
            id: string;
            content: string;
            priority: "high" | "medium" | "low";
        }[];
    }, string>;
    TodoRead: import("ai").Tool<{}, string>;
    Diagnostics: import("ai").Tool<{
        file_path?: string | undefined;
        command?: string | undefined;
    }, string>;
    AskUser: import("ai").Tool<{
        question: string;
        options?: string[] | undefined;
    }, string>;
    WebFetch: import("ai").Tool<{
        url: string;
        prompt?: string | undefined;
    }, string>;
    WebSearch: import("ai").Tool<{
        query: string;
        numResults: number;
    }, string>;
    Task: import("ai").Tool<{
        description: string;
        prompt: string;
    }, string>;
    Batch: import("ai").Tool<{
        tool_calls: {
            tool: string;
            parameters: Record<string, any>;
        }[];
    }, string>;
    ApplyPatch: ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            patch: string;
        }>;
        inputExamples?: {
            input: NoInfer<{
                patch: string;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            patch: string;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                patch: string;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                patch: string;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type?: undefined | "function";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            patch: string;
        }>;
        inputExamples?: {
            input: NoInfer<{
                patch: string;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            patch: string;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                patch: string;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                patch: string;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "dynamic";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            patch: string;
        }>;
        inputExamples?: {
            input: NoInfer<{
                patch: string;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            patch: string;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                patch: string;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        outputSchema: import("ai").FlexibleSchema<string>;
        execute?: never;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                patch: string;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        supportsDeferredResults?: boolean;
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            patch: string;
        }>;
        inputExamples?: {
            input: NoInfer<{
                patch: string;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            patch: string;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                patch: string;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            patch: string;
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                patch: string;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type?: undefined | "function";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            patch: string;
        }>;
        inputExamples?: {
            input: NoInfer<{
                patch: string;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            patch: string;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                patch: string;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            patch: string;
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                patch: string;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "dynamic";
    }) | ({
        description?: string;
        title?: string;
        providerOptions?: import("@ai-sdk/provider-utils").ProviderOptions;
        inputSchema: import("ai").FlexibleSchema<{
            patch: string;
        }>;
        inputExamples?: {
            input: NoInfer<{
                patch: string;
            }>;
        }[] | undefined;
        needsApproval?: boolean | import("@ai-sdk/provider-utils").ToolNeedsApprovalFunction<{
            patch: string;
        }> | undefined;
        strict?: boolean;
        onInputStart?: (options: import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputDelta?: (options: {
            inputTextDelta: string;
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>;
        onInputAvailable?: ((options: {
            input: {
                patch: string;
            };
        } & import("ai").ToolExecutionOptions) => void | PromiseLike<void>) | undefined;
    } & {
        execute: import("ai").ToolExecuteFunction<{
            patch: string;
        }, string>;
        outputSchema?: import("ai").FlexibleSchema<string> | undefined;
    } & {
        toModelOutput?: ((options: {
            toolCallId: string;
            input: {
                patch: string;
            };
            output: string;
        }) => import("@ai-sdk/provider-utils").ToolResultOutput | PromiseLike<import("@ai-sdk/provider-utils").ToolResultOutput>) | undefined;
    } & {
        type: "provider";
        id: `${string}.${string}`;
        args: Record<string, unknown>;
        supportsDeferredResults?: boolean;
    });
    CodeSearch: import("ai").Tool<{
        query: string;
    }, string>;
    HttpRequest: import("ai").Tool<{
        timeout: number;
        url: string;
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
        headers?: Record<string, string> | undefined;
        body?: string | undefined;
    }, string>;
    ApiSpec: import("ai").Tool<{
        url: string;
        format: "auto" | "openapi";
    }, string>;
};
