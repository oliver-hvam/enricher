import { NextRequest, NextResponse } from "next/server";
import { getListRows } from "@/lib/data-access/lists"; // DAL call

export const runtime = "nodejs";

/**
 * GET /api/lists/:id/rows?cursor=<uuid>&limit=<int>
 * Returns paginated rows and their column definitions.
 */

interface RouteContext {
  params: Promise<{
    listId: string;
  }>;
}
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const listId = (await context.params).listId;
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") ?? 50);
    const cursor = searchParams.get("cursor");

    // Get data from DAL (rows + columns + nextCursor)
    const result = await getListRows(listId, { limit, cursor });

    if (!result) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Transform rows to client shape: values keyed by column ID
    const nameToId = new Map(result.columns.map((c) => [c.name, c.id]));
    const rows = result.rows.map((r) => {
      const values: Record<string, string | null> = {};
      for (const [name, value] of Object.entries(r.row)) {
        const id = nameToId.get(name);
        if (id) values[id] = (value as string) ?? null;
      }
      return { id: r.id, values };
    });

    return NextResponse.json({ rows, nextCursor: result.nextCursor });
  } catch (err: unknown) {
    let error = "Failed to fetch list rows";
    if (err instanceof Error) {
      error = err.message;
    }
    console.error("Failed to fetch list rows", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
