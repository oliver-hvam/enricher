import "server-only";

import { desc, eq, inArray, sql, asc, gt, and } from "drizzle-orm";
import { db } from "@/db";
import { datasetRows, datasets, datasetColumns } from "@/db/schema";
import { randomUUID } from "crypto";

export interface ParsedDataset {
  columns: string[];
  rows: string[][];
}

export type JsonRow = Record<string, unknown>;

export async function datasetExistsByName(name: string): Promise<boolean> {
  const rows = await db
    .select({ id: datasets.id })
    .from(datasets)
    .where(eq(datasets.name, name))
    .limit(1);
  return rows.length > 0;
}

export async function createDataset(name: string): Promise<string> {
  const id = randomUUID();
  await db.insert(datasets).values({ id, name });
  return id;
}

export async function getColumnById(columnId: string) {
  const [column] = await db
    .select({
      id: datasetColumns.id,
      datasetId: datasetColumns.dataset_id,
      name: datasetColumns.name,
      position: datasetColumns.position,
      metadata: datasetColumns.metadata,
      createdAt: datasetColumns.createdAt,
    })
    .from(datasetColumns)
    .where(eq(datasetColumns.id, columnId));

  return column;
}

export async function insertColumns(datasetId: string, header: string[]) {
  if (header.length === 0) return;
  await db.insert(datasetColumns).values(
    header.map((name, i) => ({
      id: randomUUID(),
      dataset_id: datasetId,
      name,
      position: i,
      metadata: null,
    }))
  );
}

export async function insertRowsBatch(
  datasetId: string,
  rows: JsonRow[]
): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(datasetRows).values(rows.map((row) => ({ datasetId, row })));
}

export async function getAllDatasets() {
  const baseDatasets = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      createdAt: datasets.createdAt,
      updatedAt: datasets.updatedAt,
    })
    .from(datasets)
    .orderBy(desc(datasets.createdAt));

  if (!baseDatasets.length) {
    return [];
  }

  const datasetIds = baseDatasets.map((dataset) => dataset.id);

  const [columnCounts, rowCounts] = await Promise.all([
    db
      .select({
        datasetId: datasetColumns.dataset_id,
        count: sql<number>`count(*)::int`,
      })
      .from(datasetColumns)
      .where(inArray(datasetColumns.dataset_id, datasetIds))
      .groupBy(datasetColumns.dataset_id),
    db
      .select({
        datasetId: datasetRows.datasetId,
        count: sql<number>`count(*)::int`,
      })
      .from(datasetRows)
      .where(inArray(datasetRows.datasetId, datasetIds))
      .groupBy(datasetRows.datasetId),
  ]);

  const columnCountMap = new Map(
    columnCounts.map((entry) => [entry.datasetId, entry.count])
  );
  const rowCountMap = new Map(
    rowCounts.map((entry) => [entry.datasetId, entry.count])
  );

  return baseDatasets.map((dataset) => ({
    id: dataset.id,
    name: dataset.name,
    createdAt: dataset.createdAt,
    updatedAt: dataset.updatedAt,
    columnCount: columnCountMap.get(dataset.id) ?? 0,
    rowCount: rowCountMap.get(dataset.id) ?? 0,
  }));
}

export async function getDatasetById(datasetId: string) {
  const dataset = await db.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  });

  if (!dataset) {
    return null;
  }

  const columns = await db
    .select({
      id: datasetColumns.id,
      name: datasetColumns.name,
      position: datasetColumns.position,
      metadata: datasetColumns.metadata,
      createdAt: datasetColumns.createdAt,
    })
    .from(datasetColumns)
    .where(eq(datasetColumns.dataset_id, datasetId))
    .orderBy(datasetColumns.position);

  return {
    id: dataset.id,
    name: dataset.name,
    createdAt: dataset.createdAt,
    updatedAt: dataset.updatedAt,
    columns,
  };
}

export async function deleteDataset(datasetId: string): Promise<boolean> {
  const result = await db
    .delete(datasets)
    .where(eq(datasets.id, datasetId))
    .returning({ id: datasets.id });

  return result.length > 0;
}

export async function getDatasetRowCount(datasetId: string) {
  const [result] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(datasetRows)
    .where(eq(datasetRows.datasetId, datasetId));

  return result?.count ?? 0;
}

interface GetDatasetRowsOptions {
  limit?: number;
  offset?: number;
}

export async function getDatasetRows(
  datasetId: string,
  options?: GetDatasetRowsOptions
) {
  let query = db
    .select({
      id: datasetRows.id,
      row: datasetRows.row,
      createdAt: datasetRows.createdAt,
    })
    .from(datasetRows)
    .where(eq(datasetRows.datasetId, datasetId))
    .$dynamic();

  if (options?.limit !== undefined) {
    query = query.limit(options.limit);
  }

  if (options?.offset !== undefined) {
    query = query.offset(options.offset);
  }

  return await query;
}

export async function getDatasetWithRows(
  datasetId: string,
  options?: GetDatasetRowsOptions
) {
  const dataset = await getDatasetById(datasetId);

  if (!dataset) {
    return null;
  }

  const [rowCount, rows] = await Promise.all([
    getDatasetRowCount(datasetId),
    getDatasetRows(datasetId, options),
  ]);

  return {
    ...dataset,
    rows,
    rowCount,
  };
}

export async function getDatasetWithColumnsOnly(datasetId: string) {
  // Fetch dataset metadata
  const dataset = await db.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  });

  if (!dataset) return null;

  // Fetch column definitions
  const columns = await db
    .select({
      id: datasetColumns.id,
      name: datasetColumns.name,
      position: datasetColumns.position,
      metadata: datasetColumns.metadata,
    })
    .from(datasetColumns)
    .where(eq(datasetColumns.dataset_id, datasetId))
    .orderBy(datasetColumns.position);

  // Return a clean object
  return {
    id: dataset.id,
    name: dataset.name,
    createdAt: dataset.createdAt,
    updatedAt: dataset.updatedAt,
    columns,
    columnCount: columns.length,
    rowCount: 0, // optional placeholder (if you track it separately, query it)
  };
}

interface GetListRowsOptions {
  limit: number;
  cursor?: string | null;
}

export async function getListRows(
  listId: string,
  { limit, cursor }: GetListRowsOptions
) {
  // Verify list exists
  console.log("Fetching list with ID:", listId);
  const list = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      createdAt: datasets.createdAt,
      updatedAt: datasets.updatedAt,
    })
    .from(datasets)
    .where(eq(datasets.id, listId))
    .limit(1);

  console.log("Fetched list:", list);
  if (list.length === 0) return null;

  // Fetch columns
  const columns = await db
    .select({
      id: datasetColumns.id,
      name: datasetColumns.name,
      position: datasetColumns.position,
      metadata: datasetColumns.metadata,
    })
    .from(datasetColumns)
    .where(eq(datasetColumns.dataset_id, listId))
    .orderBy(datasetColumns.position);

  // Fetch rows (cursor pagination)
  const condition = cursor
    ? and(eq(datasetRows.datasetId, listId), gt(datasetRows.id, cursor))
    : eq(datasetRows.datasetId, listId);

  const rowsQuery = db
    .select({
      id: datasetRows.id,
      row: datasetRows.row,
      createdAt: datasetRows.id,
    })
    .from(datasetRows)
    .where(condition)
    .orderBy(asc(datasetRows.id))
    .limit(limit);

  const rows = await rowsQuery;

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

  console.log("Fetched rows:", rows.length, "Next cursor:", nextCursor);
  return {
    listId,
    columns,
    rows,
    nextCursor,
  };
}

export async function getRowIds(
  targetColumn: { datasetId: string; name: string },
  includeNonNull = true
) {
  const rows = await db
    .select({ id: datasetRows.id })
    .from(datasetRows)
    .where(
      and(
        eq(datasetRows.datasetId, targetColumn.datasetId),
        includeNonNull ? sql`1=1` : sql`(row->>${targetColumn.name}) IS NULL`
      )
    );

  return rows.map((r) => r.id);
}
