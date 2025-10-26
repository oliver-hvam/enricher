import { eq } from "drizzle-orm";

import { db } from "@/db";
import { datasetRows, datasets, listColumns } from "@/db/schema";
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

export async function insertColumns(datasetId: string, header: string[]) {
  if (header.length === 0) return;
  await db.insert(listColumns).values(
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

/*
export async function createListFromCsvStream(
  name: string,
  header: string[],
  rows: AsyncIterable<string[]>,
  options?: { batchSizeRows?: number; maxCellsPerInsert?: number }
) {
  if (!header.length) throw new Error("CSV header row is empty");

  const batchSizeRows = options?.batchSizeRows ?? 250; // tune to stay under payload limits
  const maxCellsPerInsert = options?.maxCellsPerInsert ?? 5000; // keep Neon payload safe

  return db.transaction(async (tx) => {
    const [insertedList] = await tx
      .insert(lists)
      .values({ name })
      .returning({ id: lists.id });
    if (!insertedList) throw new Error("Failed to create list");

    const insertedColumns = await tx
      .insert(listColumns)
      .values(
        header.map((columnName, index) => ({
          listId: insertedList.id,
          name: columnName.trim(),
          position: index,
        }))
      )
      .values(
        header.map((columnName, index) => ({
          listId: insertedList.id,
          name: columnName.trim(),
          position: index,
        }))
      )
      .returning({ id: listColumns.id, position: listColumns.position });

    const buffer: string[][] = [];
    let nextRowPosition = 0;

    async function flushBuffer() {
      if (buffer.length === 0) return;

      const positions = Array.from(
        { length: buffer.length },
        (_, i) => nextRowPosition + i
      );
      const rowsToInsert = positions.map((pos) => ({
        listId: insertedList.id,
        position: pos,
      }));
      const positions = Array.from(
        { length: buffer.length },
        (_, i) => nextRowPosition + i
      );
      const rowsToInsert = positions.map((pos) => ({
        listId: insertedList.id,
        position: pos,
      }));
      const insertedRows = await tx
        .insert(listRows)
        .values(rowsToInsert)
        .returning({ id: listRows.id, position: listRows.position });

      // Build and insert cells in chunks to avoid oversized payloads
      let cellBatch: {
        rowId: string;
        columnId: string;
        rawValue: string | null;
      }[] = [];
      const pushCell = async (cell: {
        rowId: string;
        columnId: string;
        rawValue: string | null;
      }) => {
      let cellBatch: {
        rowId: string;
        columnId: string;
        rawValue: string | null;
      }[] = [];
      const pushCell = async (cell: {
        rowId: string;
        columnId: string;
        rawValue: string | null;
      }) => {
        cellBatch.push(cell);
        if (cellBatch.length >= maxCellsPerInsert) {
          await tx.insert(listCells).values(cellBatch);
          cellBatch = [];
        }
      };

      for (const row of insertedRows) {
        const sourceRow = buffer[row.position - nextRowPosition] ?? [];
        for (const col of insertedColumns) {
          const rawValue = sourceRow[col.position] ?? null;
          await pushCell({ rowId: row.id, columnId: col.id, rawValue });
        }
      }

      if (cellBatch.length) {
        await tx.insert(listCells).values(cellBatch);
      }

      nextRowPosition += buffer.length;
      buffer.length = 0;
    }

    for await (const row of rows) {
      buffer.push(row);
      if (buffer.length >= batchSizeRows) {
        await flushBuffer();
      }
    }

    await flushBuffer();

    await tx
      .update(lists)
      .set({ updatedAt: sql`now()` })
      .where(eq(lists.id, insertedList.id));

    return insertedList.id;
  });
}
*/

/*
export async function getLists() {
  const baseLists = await db
    .select({
      id: lists.id,
      name: lists.name,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt,
    })
    .from(lists)
    .orderBy(desc(lists.createdAt));

  if (!baseLists.length) {
    return [];
  }

  const listIds = baseLists.map((list) => list.id);

  const [columnCounts, rowCounts] = await Promise.all([
    db
      .select({
        listId: listColumns.listId,
        count: sql<number>`count(*)::int`,
      })
      .from(listColumns)
      .where(inArray(listColumns.listId, listIds))
      .groupBy(listColumns.listId),
    db
      .select({
        listId: listRows.listId,
        count: sql<number>`count(*)::int`,
      })
      .from(listRows)
      .where(inArray(listRows.listId, listIds))
      .groupBy(listRows.listId),
  ]);

  const columnCountMap = new Map(
    columnCounts.map((entry) => [entry.listId, entry.count])
  );
  const rowCountMap = new Map(
    rowCounts.map((entry) => [entry.listId, entry.count])
  );

  return baseLists.map((list) => ({
    id: list.id,
    name: list.name,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    columnCount: columnCountMap.get(list.id) ?? 0,
    rowCount: rowCountMap.get(list.id) ?? 0,
  }));
}

export async function createListWithDataset(
  name: string,
  dataset: ParsedDataset
) {
  if (!dataset.columns.length) {
    throw new Error("Dataset must include at least one column");
  }

  return db.transaction(async (tx) => {
    const [insertedList] = await tx
      .insert(lists)
      .values({
        name,
      })
      .returning({ id: lists.id });

    if (!insertedList) {
      throw new Error("Failed to create list");
    }

    const columnValues = dataset.columns.map((columnName, index) => ({
      name: columnName,
      position: index,
      listId: insertedList.id,
    }));

    const insertedColumns = columnValues.length
      ? await tx
          .insert(listColumns)
          .values(columnValues)
          .returning({ id: listColumns.id, position: listColumns.position })
      : [];

    const rowValues = dataset.rows.map((_, index) => ({
      listId: insertedList.id,
      position: index,
    }));

    const insertedRows = rowValues.length
      ? await tx
          .insert(listRows)
          .values(rowValues)
          .returning({ id: listRows.id, position: listRows.position })
      : [];

    if (insertedRows.length && insertedColumns.length) {
      const cellValues = insertedRows.flatMap((row) => {
        const sourceRow = dataset.rows[row.position] ?? [];
        return insertedColumns.map((column) => ({
          rowId: row.id,
          columnId: column.id,
          rawValue: sourceRow[column.position] ?? null,
        }));
      });

      if (cellValues.length) {
        await tx.insert(listCells).values(cellValues);
      }
    }

    await tx
      .update(lists)
      .set({ updatedAt: sql`now()` })
      .where(eq(lists.id, insertedList.id));

    return insertedList.id;
  });
}

export async function getListRowCount(listId: string) {
  const [result] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(listRows)
    .where(eq(listRows.listId, listId));

  return result?.count ?? 0;
}

interface GetListRowsOptions {
  limit?: number;
  offset?: number;
}

export async function getListRows(
  listId: string,
  options?: GetListRowsOptions
) {
  // Fetch rows page explicitly using limit/offset with clear branches to satisfy types
  let baseRows: { id: string; position: number }[];
  if (options?.limit !== undefined && options?.offset !== undefined) {
    baseRows = await db
      .select({ id: listRows.id, position: listRows.position })
      .from(listRows)
      .where(eq(listRows.listId, listId))
      .orderBy(asc(listRows.position))
      .limit(options.limit)
      .offset(options.offset);
  } else if (options?.limit !== undefined) {
    baseRows = await db
      .select({ id: listRows.id, position: listRows.position })
      .from(listRows)
      .where(eq(listRows.listId, listId))
      .orderBy(asc(listRows.position))
      .limit(options.limit);
  } else if (options?.offset !== undefined) {
    baseRows = await db
      .select({ id: listRows.id, position: listRows.position })
      .from(listRows)
      .where(eq(listRows.listId, listId))
      .orderBy(asc(listRows.position))
      .offset(options.offset);
  } else {
    baseRows = await db
      .select({ id: listRows.id, position: listRows.position })
      .from(listRows)
      .where(eq(listRows.listId, listId))
      .orderBy(asc(listRows.position));
  }

  if (baseRows.length === 0) {
    return [] as Array<{
      id: string;
      position: number;
      values: Record<string, string | null>;
    }>;
  }

  const rowIds = baseRows.map((r) => r.id);

  const cells = await db
    .select({
      rowId: listCells.rowId,
      columnId: listCells.columnId,
      rawValue: listCells.rawValue,
    })
    .from(listCells)
    .where(inArray(listCells.rowId, rowIds));

  const rowIdToValues = new Map<string, Record<string, string | null>>();
  for (const row of baseRows) {
    rowIdToValues.set(row.id, {});
  }
  for (const cell of cells) {
    const values = rowIdToValues.get(cell.rowId);
    if (values) {
      values[cell.columnId] = cell.rawValue ?? null;
    }
  }

  return baseRows.map((row) => ({
    id: row.id,
    position: row.position,
    values: rowIdToValues.get(row.id) ?? {},
  }));
}

export async function getListRowsAfterPosition(
  listId: string,
  cursorPosition: number,
  options?: { limit?: number }
) {
  const baseRows = await db
    .select({ id: listRows.id, position: listRows.position })
    .from(listRows)
    .where(
      and(eq(listRows.listId, listId), gt(listRows.position, cursorPosition))
    )
    .orderBy(asc(listRows.position))
    .limit(options?.limit ?? 50);

  if (baseRows.length === 0) {
    return [] as Array<{
      id: string;
      position: number;
      values: Record<string, string | null>;
    }>;
  }

  const rowIds = baseRows.map((r) => r.id);

  const cells = await db
    .select({
      rowId: listCells.rowId,
      columnId: listCells.columnId,
      rawValue: listCells.rawValue,
    })
    .from(listCells)
    .where(inArray(listCells.rowId, rowIds));

  const rowIdToValues = new Map<string, Record<string, string | null>>();
  for (const row of baseRows) {
    rowIdToValues.set(row.id, {});
  }
  for (const cell of cells) {
    const values = rowIdToValues.get(cell.rowId);
    if (values) {
      values[cell.columnId] = cell.rawValue ?? null;
    }
  }

  return baseRows.map((row) => ({
    id: row.id,
    position: row.position,
    values: rowIdToValues.get(row.id) ?? {},
  }));
}

export async function getListWithData(
  listId: string,
  options?: GetListRowsOptions
) {
  const list = await db.query.lists.findFirst({
    where: eq(lists.id, listId),
    with: {
      columns: {
        orderBy: (table, { asc }) => asc(table.position),
      },
    },
  });

  if (!list) {
    return null;
  }

  const [rowCount, rows] = await Promise.all([
    getListRowCount(listId),
    getListRows(listId, options),
  ]);

  return {
    id: list.id,
    name: list.name,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    columns: list.columns,
    rows,
    rowCount,
  };
}

export async function addColumnToList(listId: string, columnName: string) {
  return db.transaction(async (tx) => {
    const [currentMax] = await tx
      .select({
        position: listColumns.position,
      })
      .from(listColumns)
      .where(eq(listColumns.listId, listId))
      .orderBy(desc(listColumns.position))
      .limit(1);

    const nextPosition = (currentMax?.position ?? -1) + 1;

    const [column] = await tx
      .insert(listColumns)
      .values({
        listId,
        name: columnName,
        position: nextPosition,
      })
      .returning();

    if (!column) {
      throw new Error("Failed to create column");
    }

    const existingRows = await tx
      .select({ id: listRows.id, position: listRows.position })
      .from(listRows)
      .where(eq(listRows.listId, listId))
      .orderBy(desc(listRows.position));

    if (existingRows.length) {
      const cellValues = existingRows.map((row) => ({
        rowId: row.id,
        columnId: column.id,
        rawValue: null,
      }));

      await tx.insert(listCells).values(cellValues);
    }

    await tx
      .update(lists)
      .set({ updatedAt: sql`now()` })
      .where(eq(lists.id, listId));

    return column;
  });
}

export async function getRowValues(
  listId: string,
  rowId: string
): Promise<Record<string, string | null>> {
  const cells = await db
    .select({
      columnId: listCells.columnId,
      rawValue: listCells.rawValue,
    })
    .from(listCells)
    .innerJoin(listRows, eq(listCells.rowId, listRows.id))
    .where(and(eq(listCells.rowId, rowId), eq(listRows.listId, listId)));

  return Object.fromEntries(
    cells.map((cell) => [cell.columnId, cell.rawValue ?? null])
  );
}
*/
