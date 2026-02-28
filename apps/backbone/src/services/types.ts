export interface Service {
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  skipAgent: boolean;
  source: string;
  dir: string;
  content: string;
  metadata: Record<string, unknown>;
}
