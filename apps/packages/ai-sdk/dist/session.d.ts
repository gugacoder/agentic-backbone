import type { ModelMessage } from "ai";
export declare function loadSession(dir: string, sessionId: string): Promise<ModelMessage[]>;
export declare function saveSession(dir: string, sessionId: string, messages: ModelMessage[]): Promise<void>;
