import {
  existsSync,
  readdirSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { usersDir, userDir } from "../context/paths.js";
import { parseFrontmatter } from "../context/frontmatter.js";
import {
  type UserConfig,
  type UserPermissions,
  DEFAULT_PERMISSIONS,
  SYSTEM_USER,
} from "./types.js";
import { hashPassword } from "./password.js";

function parseUserConfig(slug: string): UserConfig | null {
  const mdPath = join(userDir(slug), "USER.md");
  if (!existsSync(mdPath)) return null;

  const raw = readFileSync(mdPath, "utf-8");
  const { metadata } = parseFrontmatter(raw);

  return {
    slug: (metadata.slug as string) ?? slug,
    displayName: (metadata.displayName as string) ?? slug,
    permissions: {
      canCreateAgents:
        metadata.canCreateAgents !== undefined
          ? Boolean(metadata.canCreateAgents)
          : DEFAULT_PERMISSIONS.canCreateAgents,
      canCreateChannels:
        metadata.canCreateChannels !== undefined
          ? Boolean(metadata.canCreateChannels)
          : DEFAULT_PERMISSIONS.canCreateChannels,
      maxAgents:
        typeof metadata.maxAgents === "number"
          ? metadata.maxAgents
          : DEFAULT_PERMISSIONS.maxAgents,
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
  const mdPath = join(userDir(slug), "USER.md");
  if (!existsSync(mdPath)) return null;

  const raw = readFileSync(mdPath, "utf-8");
  const { metadata } = parseFrontmatter(raw);

  const passwordHash = metadata.passwordHash as string | undefined;
  if (!passwordHash) return null;

  const config = parseUserConfig(slug);
  if (!config) return null;

  return { config, passwordHash };
}

export function createUser(
  slug: string,
  displayName: string,
  password: string,
  permissions?: Partial<UserPermissions>
): UserConfig {
  const dir = userDir(slug);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "channels"), { recursive: true });

  const perms = { ...DEFAULT_PERMISSIONS, ...permissions };
  const passwordHash = hashPassword(password);

  const frontmatter = [
    "---",
    `slug: ${slug}`,
    `displayName: ${displayName}`,
    `passwordHash: "${passwordHash}"`,
    `canCreateAgents: ${perms.canCreateAgents}`,
    `canCreateChannels: ${perms.canCreateChannels}`,
    `maxAgents: ${perms.maxAgents}`,
    "---",
  ].join("\n");

  writeFileSync(join(dir, "USER.md"), `${frontmatter}\n\n# ${displayName}\n`);

  return { slug, displayName, permissions: perms };
}

export function updateUser(
  slug: string,
  updates: {
    displayName?: string;
    password?: string;
    permissions?: Partial<UserPermissions>;
  }
): UserConfig | null {
  const mdPath = join(userDir(slug), "USER.md");
  if (!existsSync(mdPath)) return null;

  const current = getUser(slug);
  if (!current) return null;

  const displayName = updates.displayName ?? current.displayName;
  const perms = { ...current.permissions, ...updates.permissions };

  // Preserve existing passwordHash or compute new one
  const raw = readFileSync(mdPath, "utf-8");
  const { metadata } = parseFrontmatter(raw);
  const passwordHash = updates.password
    ? hashPassword(updates.password)
    : (metadata.passwordHash as string) ?? "";

  const frontmatterLines = [
    "---",
    `slug: ${slug}`,
    `displayName: ${displayName}`,
  ];
  if (passwordHash) {
    frontmatterLines.push(`passwordHash: "${passwordHash}"`);
  }
  frontmatterLines.push(
    `canCreateAgents: ${perms.canCreateAgents}`,
    `canCreateChannels: ${perms.canCreateChannels}`,
    `maxAgents: ${perms.maxAgents}`,
    "---"
  );

  writeFileSync(mdPath, `${frontmatterLines.join("\n")}\n\n# ${displayName}\n`);

  return { slug, displayName, permissions: perms };
}

export function deleteUser(slug: string): boolean {
  if (slug === "system") return false;
  const dir = userDir(slug);
  if (!existsSync(dir)) return false;

  rmSync(dir, { recursive: true, force: true });
  return true;
}
