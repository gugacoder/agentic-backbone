import type { ModelMessage } from "ai";
export declare function resolveRefs(content: unknown[], attachmentsDir: string): Promise<unknown[]>;
export declare function loadSession(dir: string): Promise<ModelMessage[]>;
export declare function filterOldMedia(messages: ModelMessage[], lastUserIndex: number): ModelMessage[];
export declare function saveSession(dir: string, messages: (ModelMessage & {
    _meta?: Record<string, unknown>;
})[]): Promise<void>;
