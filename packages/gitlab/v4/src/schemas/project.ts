import { z } from "zod";
import { UserRefSchema } from "./common.js";

export const ProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  name_with_namespace: z.string().optional(),
  path: z.string(),
  path_with_namespace: z.string(),
  description: z.string().nullable().optional(),
  web_url: z.string().optional(),
  visibility: z.string().optional(),
  created_at: z.string().optional(),
  last_activity_at: z.string().optional(),
}).passthrough();

export type Project = z.infer<typeof ProjectSchema>;

export const ProjectMemberSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  access_level: z.number(),
  expires_at: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
}).passthrough();

export type ProjectMember = z.infer<typeof ProjectMemberSchema>;
