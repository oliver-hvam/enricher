import { logger } from "@trigger.dev/sdk/v3";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import pLimit from "p-limit";
import { z } from "zod";

import {
  LlmTransformationConfig,
  TransformationDependencyRow,
  TransformationUpdate,
} from "./types";
import { backoffMs, delay } from "./utils";

const RowValueSchema = z.object({ value: z.string() });

const LLM_MAX_CONCURRENCY = 4;
const MAX_RETRIES = 3;
export const DEFAULT_LLM_MODEL = "gpt-4.1-mini";

const MUSTACHE_VARIABLE = /{{\s*([\w.]+)\s*}}/g;

const convertMustacheToPromptTemplate = (template: string) =>
  template.replace(MUSTACHE_VARIABLE, "{$1}");

const sanitizeDependencies = (
  dependencies: Record<string, string | null>
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(dependencies).map(([key, value]) => [key, value ?? ""])
  );

export const runLlmTransformation = async ({
  rows,
  config,
}: {
  rows: TransformationDependencyRow[];
  config: LlmTransformationConfig;
}) => {
  if (rows.length === 0) {
    return [];
  }

  const promptTemplate = ChatPromptTemplate.fromTemplate(
    convertMustacheToPromptTemplate(config.prompt)
  );
  const model = config.model ?? DEFAULT_LLM_MODEL;
  const llm = new ChatOpenAI({ model });
  const structuredLlm = promptTemplate.pipe(
    llm.withStructuredOutput(RowValueSchema)
  );

  const limit = pLimit(LLM_MAX_CONCURRENCY);

  const updates = await Promise.all(
    rows.map((row) =>
      limit(async () => {
        const promptInput = sanitizeDependencies(row.dependencies);

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const output = await structuredLlm.invoke(promptInput);
            const value = (output?.value ?? "").toString();
            return { id: row.id, value } satisfies TransformationUpdate;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : error;
            logger.error("LLM transformation attempt failed", {
              rowId: row.id,
              attempt,
              error: String(errorMessage),
            });

            if (attempt === MAX_RETRIES) {
              return { id: row.id, value: "" };
            }

            await delay(backoffMs(attempt));
          }
        }

        return { id: row.id, value: "" };
      })
    )
  );

  return updates;
};
