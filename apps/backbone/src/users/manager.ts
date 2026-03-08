import {
  existsSync,
  readdirSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { usersDir, userDir } from "../context/paths.js";
import { readMarkdown, writeMarkdown, readYaml, writeYaml } from "../context/readers.js";
import { UserMdSchema, CredentialYmlSchema } from "../context/schemas.js";
import {
  type UserConfig,
  type UserPermissions,
  DEFAULT_PERMISSIONS,
  SYSTEM_USER,
} from "./types.js";
import { hashPassword } from "./password.js";

function credentialPath(slug: string): string {
  return join(userDir(slug), "credential.yml");
}

function parseUserConfig(slug: string): UserConfig | null {
  const mdPath = join(userDir(slug), "USER.md");
  if (!existsSync(mdPath)) return null;

  const { metadata: rawMetadata } = readMarkdown(mdPath);
  const mdResult = UserMdSchema.safeParse(rawMetadata);
  if (!mdResult.success) {
    console.warn(`[users] invalid USER.md for ${slug}:`, mdResult.error.issues);
    return null;
  }
  const md = mdResult.data;

  // Email comes from credential.yml now
  let email = md.email;
  const credPath = credentialPath(slug);
  if (existsSync(credPath)) {
    const credResult = CredentialYmlSchema.safeParse(readYaml(credPath));
    if (credResult.success) {
      email = credResult.data.email;
    }
  }

  return {
    slug: md.slug ?? slug,
    displayName: md.displayName ?? slug,
    email,
    permissions: {
      canCreateAgents: md.canCreateAgents,
      canCreateChannels: md.canCreateChannels,
      maxAgents: md.maxAgents,
    },
  };
}

export function listUsers(): UserConfig[] {
  const dir = usersDir();
  if (!existsSync(dir)) return [SYSTEM_USER];

  const users: UserConfig[] = [];
  for (const slug of readdirSync(dir)) {
    const config = parseUserConfig(slug);
    if (config) users.push(config);
  }

  // Ensure system user is always present
  if (!users.find((u) => u.slug === "system")) {
    users.unshift(SYSTEM_USER);
  }

  return users;
}

export function getUser(slug: string): UserConfig | null {
  if (slug === "system") {
    return parseUserConfig("system") ?? SYSTEM_USER;
  }
  return parseUserConfig(slug);
}

export function userExists(slug: string): boolean {
  return existsSync(join(userDir(slug), "USER.md"));
}

export function getUserWithPasswordHash(
  slug: string
): { config: UserConfig; passwordHash: string } | null {
  const credPath = credentialPath(slug);
  if (!existsSync(credPath)) return null;

  const credResult = CredentialYmlSchema.safeParse(readYaml(credPath));
  if (!credResult.success) return null;
  const passwordHash = credResult.data.password;
  if (!passwordHash) return null;

  const config = parseUserConfig(slug);
  if (!config) return null;

  return { config, passwordHash };
}

export function createUser(
  slug: string,
  displayName: string,
  password: string,
  permissions?: Partial<UserPermissions>,
  email?: string
): UserConfig {
  const dir = userDir(slug);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "channels"), { recursive: true });

  const perms = { ...DEFAULT_PERMISSIONS, ...permissions };
  const passwordHash = hashPassword(password);
  const userEmail = email ?? "";

  // USER.md — profile (no secrets)
  writeMarkdown(join(dir, "USER.md"), {
    slug,
    displayName,
    canCreateAgents: perms.canCreateAgents,
    canCreateChannels: perms.canCreateChannels,
    maxAgents: perms.maxAgents,
  }, `# ${displayName}\n`);

  // credential.yml — secrets (auto-encrypted)
  writeYaml(credentialPath(slug), {
    type: "user-password",
    email: userEmail,
    password: passwordHash,
  });

  return { slug, displayName, email: userEmail, permissions: perms };
}

export function updateUser(
  slug: string,
  updates: {
    displayName?: string;
    email?: string;
    password?: string;
    permissions?: Partial<UserPermissions>;
  }
): UserConfig | null {
  const mdPath = join(userDir(slug), "USER.md");
  if (!existsSync(mdPath)) return null;

  const current = getUser(slug);
  if (!current) return null;

  const displayName = updates.displayName ?? current.displayName;
  const email = updates.email ?? current.email;
  const perms = { ...current.permissions, ...updates.permissions };

  // Update USER.md (profile only)
  writeMarkdown(mdPath, {
    slug,
    displayName,
    canCreateAgents: perms.canCreateAgents,
    canCreateChannels: perms.canCreateChannels,
    maxAgents: perms.maxAgents,
  }, `# ${displayName}\n`);

  // Update credential.yml
  const credPath = credentialPath(slug);
  const cred = existsSync(credPath) ? readYaml(credPath) : { type: "user-password" };

  if (updates.email !== undefined) cred.email = updates.email;
  if (updates.password) cred.password = hashPassword(updates.password);

  writeYaml(credPath, cred);

  return { slug, displayName, email, permissions: perms };
}

export function deleteUser(slug: string): boolean {
  if (slug === "system") return false;
  const dir = userDir(slug);
  if (!existsSync(dir)) return false;

  rmSync(dir, { recursive: true, force: true });
  return true;
}
