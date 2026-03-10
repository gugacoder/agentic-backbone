export interface MysqlParams {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface PostgresParams {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface EvolutionParams {
  host: string;
  port: number;
  apiKey: string;
  instanceName: string;
}

export interface WhisperParams {
  host: string;
  port: number;
}

export interface MysqlConnector {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  mutate(sql: string, params?: unknown[]): Promise<unknown>;
  health(): Promise<string>;
  close(): Promise<void>;
}

export interface PostgresConnector {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  mutate(sql: string, params?: unknown[]): Promise<{ rowCount: number | null; command: string }>;
  health(): Promise<string>;
  close(): Promise<void>;
}

export interface EvolutionConnector {
  get(endpoint: string): Promise<unknown>;
  send(endpoint: string, body?: unknown): Promise<unknown>;
  health(): Promise<string>;
  close(): Promise<void>;
}

export interface WhisperConnector {
  transcribe(options: TranscribeOptions): Promise<{ text: string }>;
  health(): Promise<string>;
  close(): Promise<void>;
}

export interface TranscribeOptions {
  audioUrl?: string;
  audioBase64?: string;
  filename?: string;
  language?: string;
}
