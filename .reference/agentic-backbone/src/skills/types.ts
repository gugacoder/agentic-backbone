export interface SkillMetadata {
  always?: boolean;
  primaryEnv?: string;
  os?: string[];
  requires?: {
    bins?: string[];
    env?: string[];
  };
}

export interface Skill {
  name: string;
  description: string;
  body: string;
  source: string;
  dir: string;
  metadata?: SkillMetadata;
}

export interface SkillConfig {
  enabled?: boolean;
  apiKey?: string;
  env?: Record<string, string>;
}

export interface SkillsSnapshot {
  skills: Skill[];
  prompt: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}
