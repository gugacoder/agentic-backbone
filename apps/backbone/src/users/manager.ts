import {
  existsSync,
  readdirSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import {
  usersDir,
  userDir,
  userMdPath,
  credentialsUsersDir,
  userCredentialPath,
} from "../context/paths.js";
import { readMarkdownAs, writeMarkdownAs, patchMarkdownAs, readYamlAs, writeYamlAs, patchYamlAs } from "../context/readers.js";
import { UserMdSchema, UserCredentialYmlSchema } from "../context/schemas.js";
import {
  type UserConfig,
  type UserPermissions,
  type UserAddress,
  DEFAULT_PERMISSIONS,
  SYSTEM_USER,
} from "./types.js";

function parseUserConfig(slug: string): UserConfig | null {
  const mdPath = userMdPath(slug);
  if (!existsSync(mdPath)) return null;

  const result = UserMdSchema.safeParse(
    (() => { try { return readMarkdownAs(mdPath, UserMdSchema).metadata; } catch { return null; } })()
  );
  if (!result.success) {
    console.warn(`[users] invalid USER.md for ${slug}:`, result.error.issues);
    return null;
  }
  const u = result.data;

  return {
    slug: u.slug ?? slug,
    displayName: u.displayName ?? slug,
    email: u.email,
    phoneNumber: u.phoneNumber,
    role: u.role,
    permissions: {
      canCreateAgents: u.canCreateAgents,
      canCreateChannels: u.canCreateChannels,
      maxAgents: u.maxAgents,
    },
    address: u.address,
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
  return existsSync(userMdPath(slug));
}

export function getUserCredential(
  slug: string
): { config: UserConfig; password: string } | null {
  const credPath = userCredentialPath(slug);
  if (!existsSync(credPath)) return null;

  let cred: ReturnType<typeof UserCredentialYmlSchema.parse>;
  try {
    cred = readYamlAs(credPath, UserCredentialYmlSchema);
  } catch {
    return null;
  }

  if (!cred.password) return null;

  const config = parseUserConfig(slug);
  if (!config) return null;

  return { config, password: cred.password };
}

export function getUserByEmail(
  email: string
): { slug: string; config: UserConfig; password: string } | null {
  const dir = usersDir();
  if (!existsSync(dir)) return null;

  for (const slug of readdirSync(dir)) {
    const mdPath = userMdPath(slug);
    if (!existsSync(mdPath)) continue;

    let data: ReturnType<typeof UserMdSchema.parse>;
    try {
      data = readMarkdownAs(mdPath, UserMdSchema).metadata;
    } catch {
      continue;
    }

    if (data.email !== email) continue;

    const record = getUserCredential(slug);
    if (!record) continue;

    return { slug, config: record.config, password: record.password };
  }

  return null;
}

export function createUser(
  slug: string,
  displayName: string,
  password: string,
  permissions?: Partial<UserPermissions>,
  email?: string,
  phoneNumber?: string,
  address?: UserAddress
): UserConfig {
  const dir = userDir(slug);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "channels"), { recursive: true });
  mkdirSync(credentialsUsersDir(), { recursive: true });

  const perms = { ...DEFAULT_PERMISSIONS, ...permissions };
  const userEmail = email ?? "";

  writeMarkdownAs(userMdPath(slug), {
    slug,
    displayName,
    email: userEmail,
    phoneNumber: phoneNumber ?? undefined,
    canCreateAgents: perms.canCreateAgents,
    canCreateChannels: perms.canCreateChannels,
    maxAgents: perms.maxAgents,
    address: address ?? undefined,
  }, `# ${displayName}\n`, UserMdSchema);

  writeYamlAs(userCredentialPath(slug), {
    type: "user-password",
    password,
  }, UserCredentialYmlSchema);

  return { slug, displayName, email: userEmail, phoneNumber, permissions: perms, address };
}

export function updateUser(
  slug: string,
  updates: {
    displayName?: string;
    email?: string;
    phoneNumber?: string;
    password?: string;
    role?: string | null;
    address?: UserAddress;
    permissions?: Partial<UserPermissions>;
  }
): UserConfig | null {
  if (!userExists(slug)) return null;

  const profilePatch: Record<string, unknown> = {};

  if (updates.displayName !== undefined) profilePatch.displayName = updates.displayName;
  if (updates.email !== undefined) profilePatch.email = updates.email;
  if (updates.phoneNumber !== undefined) profilePatch.phoneNumber = updates.phoneNumber;
  if (updates.role !== undefined) profilePatch.role = updates.role ?? undefined;
  if (updates.address !== undefined) profilePatch.address = updates.address;
  if (updates.permissions) {
    if (updates.permissions.canCreateAgents !== undefined)
      profilePatch.canCreateAgents = updates.permissions.canCreateAgents;
    if (updates.permissions.canCreateChannels !== undefined)
      profilePatch.canCreateChannels = updates.permissions.canCreateChannels;
    if (updates.permissions.maxAgents !== undefined)
      profilePatch.maxAgents = updates.permissions.maxAgents;
  }

  const { metadata: updated } = patchMarkdownAs(userMdPath(slug), profilePatch, UserMdSchema);

  if (updates.password) {
    const credPath = userCredentialPath(slug);
    if (existsSync(credPath)) {
      patchYamlAs(credPath, { password: updates.password }, UserCredentialYmlSchema);
    } else {
      writeYamlAs(credPath, { type: "user-password", password: updates.password }, UserCredentialYmlSchema);
    }
  }

  return {
    slug: updated.slug ?? slug,
    displayName: updated.displayName ?? slug,
    email: updated.email,
    phoneNumber: updated.phoneNumber,
    role: updated.role,
    permissions: {
      canCreateAgents: updated.canCreateAgents,
      canCreateChannels: updated.canCreateChannels,
      maxAgents: updated.maxAgents,
    },
    address: updated.address,
  };
}

export function deleteUser(slug: string): boolean {
  if (slug === "system") return false;
  const dir = userDir(slug);
  if (!existsSync(dir)) return false;

  rmSync(dir, { recursive: true, force: true });

  const credPath = userCredentialPath(slug);
  if (existsSync(credPath)) {
    rmSync(credPath);
  }

  return true;
}
