import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { listCells, listColumns, lists, listRows } from "@/db/schema";

export interface ParsedDataset {
  columns: string[];
  rows: string[][];
}

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
      .values(header.map((columnName, index) => ({
        listId: insertedList.id,
        name: columnName.trim(),
        position: index,
      })))
      .returning({ id: listColumns.id, position: listColumns.position });

    const buffer: string[][] = [];
    let nextRowPosition = 0;

    async function flushBuffer() {
      if (buffer.length === 0) return;

      const positions = Array.from({ length: buffer.length }, (_, i) => nextRowPosition + i);
      const rowsToInsert = positions.map((pos) => ({ listId: insertedList.id, position: pos }));
      const insertedRows = await tx
        .insert(listRows)
        .values(rowsToInsert)
        .returning({ id: listRows.id, position: listRows.position });

      // Build and insert cells in chunks to avoid oversized payloads
      let cellBatch: { rowId: string; columnId: string; rawValue: string | null }[] = [];
      const pushCell = async (cell: { rowId: string; columnId: string; rawValue: string | null }) => {
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

export async function getListWithData(listId: string) {
  const list = await db.query.lists.findFirst({
    where: eq(lists.id, listId),
    with: {
      columns: {
        orderBy: (table, { asc }) => asc(table.position),
      },
      rows: {
        orderBy: (table, { asc }) => asc(table.position),
        with: {
          cells: true,
        },
      },
    },
  });

  if (!list) {
    return null;
  }

  const columns = list.columns;
  const rows = list.rows.map((row) => ({
    id: row.id,
    position: row.position,
    values: Object.fromEntries(
      row.cells.map((cell) => [cell.columnId, cell.rawValue])
    ),
  }));

  return {
    id: list.id,
    name: list.name,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    columns,
    rows,
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
