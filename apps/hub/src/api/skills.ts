import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Resource {
  slug: string;
  name: string;
  description: string;
  source: string;
}

export interface Skill {
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  userInvocable?: boolean;
  trigger?: string;
  body: string;
  source: string;
  dir: string;
}

export interface CreateSkillInput {
  slug: string;
  scope: string;
  name: string;
  description?: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

export function allSkillsQueryOptions() {
  return queryOptions({
    queryKey: ["skills"],
    queryFn: () => request<Resource[]>("/skills"),
  });
}

export function agentSkillsQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["agents", agentId, "skills"],
    queryFn: () => request<Skill[]>(`/agents/${agentId}/skills`),
  });
}

export async function assignSkill(
  agentId: string,
  slug: string,
  sourceScope: string,
): Promise<void> {
  await request("/skills/assign", {
    method: "POST",
    body: JSON.stringify({ sourceScope, slug, agentId }),
  });
}

export async function unassignSkill(
  agentId: string,
  slug: string,
): Promise<void> {
  await request(`/skills/${agentId}/${slug}`, { method: "DELETE" });
}

export async function createSkill(input: CreateSkillInput): Promise<Skill> {
  return request<Skill>("/skills", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateSkill(
  scope: string,
  slug: string,
  updates: UpdateSkillInput,
): Promise<Skill> {
  return request<Skill>(`/skills/${scope}/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteSkill(scope: string, slug: string): Promise<void> {
  await request(`/skills/${scope}/${slug}`, { method: "DELETE" });
}

export function allServicesQueryOptions() {
  return queryOptions({
    queryKey: ["services"],
    queryFn: () => request<Resource[]>("/services"),
  });
}

export function agentServicesQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["agents", agentId, "services"],
    queryFn: () => request<Resource[]>(`/agents/${agentId}/services`),
  });
}

export async function assignService(
  agentId: string,
  slug: string,
  sourceScope: string,
): Promise<void> {
  await request("/services/assign", {
    method: "POST",
    body: JSON.stringify({ sourceScope, slug, agentId }),
  });
}

export async function unassignService(
  agentId: string,
  slug: string,
): Promise<void> {
  await request(`/services/${agentId}/${slug}`, { method: "DELETE" });
}
