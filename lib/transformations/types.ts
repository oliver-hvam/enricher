import { TransformationConfig } from "@/lib/types/transformation";

export interface TransformationDependencyRow {
  id: string;
  dependencies: Record<string, string | null>;
}

export interface TransformationUpdate {
  id: string;
  value: string;
}

export type TransformationExecutor = (
  args: TransformationDependencyRow[]
) => Promise<TransformationUpdate[]>;

export type LlmTransformationConfig = Extract<
  TransformationConfig,
  { type: "llm" }
>;
export type N8nTransformationConfig = Extract<
  TransformationConfig,
  { type: "n8n" }
>;
export type WebScrapeTransformationConfig = Extract<
  TransformationConfig,
  { type: "web_scrape" }
>;
export type CustomTransformationConfig = Extract<
  TransformationConfig,
  { type: "custom" }
>;
