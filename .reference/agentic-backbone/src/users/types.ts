export interface UserPermissions {
  canCreateAgents: boolean;
  canCreateChannels: boolean;
  maxAgents: number;
}

export interface UserConfig {
  slug: string;
  displayName: string;
  permissions: UserPermissions;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  canCreateAgents: true,
  canCreateChannels: true,
  maxAgents: 5,
};

export const SYSTEM_USER: UserConfig = {
  slug: "system",
  displayName: "System",
  permissions: {
    canCreateAgents: true,
    canCreateChannels: true,
    maxAgents: 100,
  },
};
