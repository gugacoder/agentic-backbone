import { z } from "zod";

export const WikiPageSchema = z.object({
  slug: z.string(),
  title: z.string(),
  format: z.enum(["markdown", "rdoc", "asciidoc"]).optional(),
  content: z.string().optional(),
}).passthrough();

export type WikiPage = z.infer<typeof WikiPageSchema>;
