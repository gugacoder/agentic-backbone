export declare function createApplyPatchTool(opts?: {
    autoApprove?: boolean;
}): ({
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
export declare const applyPatchTool: ({
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
