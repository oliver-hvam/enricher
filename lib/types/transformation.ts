import { z } from "zod";

export const TransformationConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("llm"),
    prompt: z.string(),
    model: z.string().optional(),
  }),
  z.object({
    type: z.literal("n8n"),
    workflowId: z.string(),
  }),
  z.object({
    type: z.literal("web_scrape"),
    urlField: z.string(),
    selector: z.string().optional(),
  }),
  z.object({
    type: z.literal("custom"),
    script: z.string(),
  }),
]);

export type TransformationConfig = z.infer<typeof TransformationConfigSchema>;
