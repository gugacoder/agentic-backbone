export declare function createMultiEditTool(opts?: {
    autoApprove?: boolean;
}): ({
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
export declare const multiEditTool: ({
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
