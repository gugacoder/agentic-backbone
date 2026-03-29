export declare const grepTool: import("ai").Tool<{
    pattern: string;
    output_mode: "content" | "files_with_matches" | "count";
    path?: string | undefined;
    glob?: string | undefined;
}, string>;
