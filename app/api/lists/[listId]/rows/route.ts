export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDatasetById, getDatasetRows } from "@/lib/data-access/lists";

interface RouteContext {
  params: Promise<{
    listId: string;
  }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { listId } = await context.params;
    const { searchParams } = new URL(req.url);

    const cursor = searchParams.get("cursor");
    const limit = searchParams.get("limit");

    const pageSize = limit ? parseInt(limit, 10) : 50;
    // Since our schema doesn't have position, we'll use offset based on cursor
    // Cursor will represent the number of rows already loaded
    const offset = cursor ? parseInt(cursor, 10) + 1 : 0;

    const dataset = await getDatasetById(listId);

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    // Create a map from column name to column ID
    const columnNameToId = new Map(
      dataset.columns.map((col) => [col.name, col.id])
    );

    const dbRows = await getDatasetRows(listId, {
      limit: pageSize,
      offset,
    });

    // Transform rows: convert from column-name-keyed to column-id-keyed
    const rows = dbRows.map((row, index) => {
      const values: Record<string, string | null> = {};

      for (const [columnName, value] of Object.entries(row.row)) {
        const columnId = columnNameToId.get(columnName);
        if (columnId) {
          values[columnId] = value as string | null;
        }
      }

      return {
        id: row.id,
        values,
        position: offset + index, // Generate position based on offset
      };
    });

    return NextResponse.json({ rows }, { status: 200 });
  } catch (err: unknown) {
    let message = "Failed to fetch rows";

    if (err instanceof Error) {
      message = err.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
