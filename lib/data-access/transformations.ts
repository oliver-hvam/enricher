import "server-only";
import { db } from "@/db";
import {
  datasetColumns,
  datasetRows,
  transformationDependencies,
  transformations,
} from "@/db/schema";
import { inArray, eq, sql } from "drizzle-orm";
import {
  TransformationDependencyRow,
  TransformationUpdate,
} from "@/lib/transformations/types";

export async function getTransformationById(transformationId: string) {
  const [transformation] = await db
    .select({
      id: transformations.id,
      columnId: transformations.columnId,
      config: transformations.config, // jsonb
      createdAt: transformations.createdAt,
    })
    .from(transformations)
    .where(eq(transformations.id, transformationId));

  return transformation;
}

export async function getTransformationDependencyColumns(
  transformationId: string
) {
  const deps = await db
    .select({
      dependsOnColumnId: transformationDependencies.dependsOnColumnId,
      name: datasetColumns.name,
    })
    .from(transformationDependencies)
    .innerJoin(
      datasetColumns,
      eq(datasetColumns.id, transformationDependencies.dependsOnColumnId)
    )
    .where(eq(transformationDependencies.transformationId, transformationId));

  return deps;
}

interface GetTransformationDependencyRowsOptions {
  rowIds: string[];
  dependencyNames: string[];
}

export async function getTransformationDependencyRows({
  rowIds,
  dependencyNames,
}: GetTransformationDependencyRowsOptions): Promise<
  TransformationDependencyRow[]
> {
  if (rowIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: datasetRows.id,
      row: datasetRows.row,
    })
    .from(datasetRows)
    .where(inArray(datasetRows.id, rowIds));

  return rows.map(({ id, row }) => ({
    id,
    dependencies: Object.fromEntries(
      dependencyNames.map((name) => [
        name,
        (row[name] as string | null | undefined) ?? null,
      ])
    ),
  }));
}

export async function applyTransformationUpdates({
  updates,
  targetColumnName,
}: {
  updates: TransformationUpdate[];
  targetColumnName: string;
}): Promise<void> {
  if (updates.length === 0) {
    return;
  }

  const valuesTuples = updates.map(
    (update) => sql`(${update.id}::uuid, ${update.value}::text)`
  );
  console.log("Applying updates - executing SQL", {
    count: valuesTuples.length,
  });

  await db.execute(sql`
    UPDATE ${datasetRows} r
    SET row = jsonb_set(
      r.row,
      ${sql.raw(`'{${targetColumnName}}'`)},
      to_jsonb(v.value),
      true
    )
    FROM (VALUES ${sql.join(valuesTuples, sql`, `)}) AS v(id, value)
    WHERE r.id = v.id
  `);
}
