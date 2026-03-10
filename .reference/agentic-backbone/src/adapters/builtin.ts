import type { ResolvedResource } from "../context/resolver.js";

export type ConnectorType = "mysql" | "postgres" | "evolution" | "whisper";

export interface BuiltinAdapterDef {
  slug: string;
  name: string;
  connector: ConnectorType;
  policy: "readonly" | "readwrite";
  description: string;
  envKeys: string[];
  params: () => Record<string, unknown>;
}

export const BUILTIN_ADAPTERS: BuiltinAdapterDef[] = [
  {
    slug: "cia-prime",
    name: "CiaPrime",
    connector: "mysql",
    policy: "readonly",
    description: "Base de negócio CiaPrimeCare — funcionários, escalas, pontos",
    envKeys: [
      "MYSQL_CIA_PRIME_HOST",
      "MYSQL_CIA_PRIME_PORT",
      "MYSQL_CIA_PRIME_DATABASE",
      "MYSQL_CIA_PRIME_USER",
      "MYSQL_CIA_PRIME_PASSWORD",
    ],
    params: () => ({
      host: process.env.MYSQL_CIA_PRIME_HOST,
      port: Number(process.env.MYSQL_CIA_PRIME_PORT),
      database: process.env.MYSQL_CIA_PRIME_DATABASE,
      user: process.env.MYSQL_CIA_PRIME_USER,
      password: process.env.MYSQL_CIA_PRIME_PASSWORD,
    }),
  },
  {
    slug: "cia-app",
    name: "CiaApp",
    connector: "postgres",
    policy: "readwrite",
    description: "Base do cia-app — permissões, preferências, avatares",
    envKeys: [
      "POSTGRES_HOST",
      "POSTGRES_PORT",
      "POSTGRES_USER",
      "POSTGRES_PASSWORD",
      "POSTGRES_DB",
    ],
    params: () => ({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    }),
  },
  {
    slug: "evolution",
    name: "Evolution",
    connector: "evolution",
    policy: "readwrite",
    description: "WhatsApp messaging via Evolution API",
    envKeys: [
      "EVOLUTION_HOST",
      "EVOLUTION_PORT",
      "EVOLUTION_API_KEY",
      "EVOLUTION_BACKBONE_INSTANCE",
    ],
    params: () => ({
      host: process.env.EVOLUTION_HOST,
      port: Number(process.env.EVOLUTION_PORT),
      apiKey: process.env.EVOLUTION_API_KEY,
      instanceName: process.env.EVOLUTION_BACKBONE_INSTANCE,
    }),
  },
  {
    slug: "whisper",
    name: "Whisper",
    connector: "whisper",
    policy: "readonly",
    description: "Transcrição de áudio via Whisper",
    envKeys: ["WHISPER_HOST", "WHISPER_PORT"],
    params: () => ({
      host: process.env.WHISPER_HOST,
      port: Number(process.env.WHISPER_PORT),
    }),
  },
];

function hasAllEnvKeys(def: BuiltinAdapterDef): boolean {
  return def.envKeys.every((key) => process.env[key]);
}

export function getBuiltinAdaptersAsResolved(): Map<string, ResolvedResource> {
  const result = new Map<string, ResolvedResource>();
  for (const def of BUILTIN_ADAPTERS) {
    if (!hasAllEnvKeys(def)) continue;
    result.set(def.slug, {
      slug: def.slug,
      path: "",
      source: "builtin",
      metadata: {
        name: def.name,
        connector: def.connector,
        policy: def.policy,
        description: def.description,
      },
      content: "",
    });
  }
  return result;
}

export function isBuiltinAdapter(slug: string): boolean {
  return BUILTIN_ADAPTERS.some((d) => d.slug === slug);
}

export function getBuiltinDef(slug: string): BuiltinAdapterDef | undefined {
  return BUILTIN_ADAPTERS.find((d) => d.slug === slug);
}
