export interface AiProviderConfig {
    /** Default API key (used for openrouter) */
    apiKey: string;
    /** Aliases de modelo: nome amigavel → model ID completo */
    aliases?: Record<string, string>;
    /** Additional providers by name (e.g. groq) */
    providers?: Record<string, {
        baseURL: string;
        apiKey: string;
    }>;
}
export declare function createAiProviderRegistry(config: AiProviderConfig): {
    /** Resolve modelo por ID ou alias, opcionalmente de um provider especifico */
    model(nameOrAlias: string, provider?: string): any;
    /** Aliases registrados */
    aliases: {
        [x: string]: string;
    };
};
