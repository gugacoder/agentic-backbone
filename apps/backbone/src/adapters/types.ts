export interface AdapterConfig {
  slug: string;
  name: string;
  connector: string;
  policy: string;
  description: string;
  source: string;
  dir: string;
  connectorDir: string | null;
  /** Raw ADAPTER.yaml content */
  content: string;
  metadata: Record<string, unknown>;
}

export interface UpdateAdapterInput {
  name?: string;
  description?: string;
  policy?: string;
  params?: Record<string, unknown>;
}
