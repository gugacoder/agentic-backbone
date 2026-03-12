import { z } from "zod";

export const credentialSchema = z.object({
  api_key: z.string().min(1),
});

export const optionsSchema = z.object({
  voice_id: z.string().default("21m00Tcm4TlvDq8ikWAM"),
  model_id: z.string().default("eleven_multilingual_v2"),
  output_format: z.string().default("mp3_44100_128"),
});
