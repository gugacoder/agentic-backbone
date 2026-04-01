export interface UserPermissions {
  canCreateAgents: boolean;
  canCreateChannels: boolean;
  maxAgents: number;
}

export interface UserAddress {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  timezone?: string;
}

export interface UserConfig {
  slug: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  role?: string;
  permissions: UserPermissions;
  address?: UserAddress;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  canCreateAgents: true,
  canCreateChannels: true,
  maxAgents: 5,
};

export const SYSTEM_USER: UserConfig = {
  slug: "system",
  displayName: "System",
  email: "",
  permissions: {
    canCreateAgents: true,
    canCreateChannels: true,
    maxAgents: 100,
  },
};
