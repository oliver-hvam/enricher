import { NextResponse } from "next/server";

export const runtime = "nodejs";

import { db } from "@/db";
import {
  datasetColumns,
  transformationDependencies,
  transformations,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const DATASET_ID = "937f8823-19e5-43ba-b765-36b57f303551";
const TARGET_COLUMN_NAME = "Excuse";
const DEPENDENCY_COLUMN_NAMES = ["First Name", "Last Name", "Interests"];
// Hardcoded transformation UUID

export async function GET() {
  try {
    // Load all columns for the dataset
    const columns = await db
      .select({ id: datasetColumns.id, name: datasetColumns.name })
      .from(datasetColumns)
      .where(eq(datasetColumns.dataset_id, DATASET_ID));

    const targetColumn = columns.find((c) => c.name === TARGET_COLUMN_NAME);
    if (!targetColumn) {
      return NextResponse.json(
        { error: `Target column '${TARGET_COLUMN_NAME}' not found` },
        { status: 404 }
      );
    }

    const dependencyColumns = columns.filter((c) =>
      DEPENDENCY_COLUMN_NAMES.includes(c.name)
    );

    // Insert the transformation (no-op if it already exists)
    const transformationId = randomUUID();
    await db
      .insert(transformations)
      .values({
        id: transformationId,
        columnId: targetColumn.id,
        config: {
          type: "llm",
          // Mustache-style variables are supported and converted at runtime
          prompt:
            "Given the following details: First Name: {{First Name}}, Last Name: {{Last Name}}, Interests: {{Interests}}. Infer a funny excuse for missing the morning meeting. Respond concisely with only the excuse in 3rd person.",
          // model: "gpt-4.1-mini", // optional override
        },
      })
      .onConflictDoUpdate({
        target: transformations.id,
        set: {
          config: {
            type: "llm",
            prompt:
              "Given the following details: First Name: {{First Name}}, Last Name: {{Last Name}}, Interests: {{Interests}}. Infer a funny excuse for missing the morning meeting. Respond concisely with only the excuse in 3rd person.",
            // model: "gpt-4.1-mini", // optional override
          },
        },
      });

    if (dependencyColumns.length > 0) {
      await db
        .insert(transformationDependencies)
        .values(
          dependencyColumns.map((col) => ({
            transformationId: transformationId,
            dependsOnColumnId: col.id,
          }))
        )
        .onConflictDoNothing();
    }

    return NextResponse.json({
      ok: true,
      transformationId: transformationId,
      targetColumnId: targetColumn.id,
      dependencies: dependencyColumns.map((c) => ({ id: c.id, name: c.name })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to insert transformation" },
      { status: 500 }
    );
  }
}
