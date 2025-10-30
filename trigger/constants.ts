import { db } from "@/db";
import { datasetRows } from "@/db/schema";
import { logger, task } from "@trigger.dev/sdk/v3";
import { sql } from "drizzle-orm/sql";
import { eq } from "drizzle-orm/sql";
import { ChatOpenAI } from "@langchain/openai";
import z from "zod";

export const helloWorldTask = task({
  id: "transformation-llm-column",
  maxDuration: 300, // 5 minutes
  run: async (
    payload: { datasetId: string; columnName: string; prompt: string },
    { ctx }
  ) => {
    logger.log("Running transformation", { payload, ctx });

    const { datasetId, columnName, prompt } = payload;

    // Define your schema
    const ColumnValueSchema = z.object({
      value: z.string(),
    });

    // Initialize the model (nano or mini)
    const llm = new ChatOpenAI({
      model: "gpt-4.1-nano",
    });

    // Wrap it with structured output
    const structuredLLM = llm.withStructuredOutput(ColumnValueSchema);

    const res = await structuredLLM.invoke(prompt);

    const valueToSet = res.value;

    await db
      .update(datasetRows)
      .set({
        row: sql`
          jsonb_set(
            row,
            ${sql.raw(`'{${columnName}}'`)},
            to_jsonb(${valueToSet}::text),
            true
          )
        `,
      })
      .where(eq(datasetRows.datasetId, datasetId));
  },
});
