export declare const httpRequestTool: import("ai").Tool<{
    timeout: number;
    url: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
    headers?: Record<string, string> | undefined;
    body?: string | undefined;
}, string>;
