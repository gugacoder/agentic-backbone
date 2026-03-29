export declare function createBashTool(opts?: {
    autoApprove?: boolean;
}): ({
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
export declare const bashTool: ({
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
