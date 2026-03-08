export interface AiProviderConfig {
    /** OpenRouter API key */
    apiKey: string;
    /** Aliases de modelo: nome amigavel → model ID completo */
    aliases?: Record<string, string>;
}
export declare function createAiProviderRegistry(config: AiProviderConfig): {
    /** Resolve modelo por ID ou alias */
    model(nameOrAlias: string): any;
    /** Aliases registrados */
    aliases: {
        [x: string]: string;
    };
};
