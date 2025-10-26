import { NextRequest, NextResponse } from "next/server";

import { getListRows, getListRowsAfterPosition } from "@/lib/data-access/lists";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
  const searchParams = request.nextUrl.searchParams;

  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const cursorParam = searchParams.get("cursor");

  const limit = limitParam ? Number(limitParam) : DEFAULT_PAGE_SIZE;
  const offset = offsetParam ? Number(offsetParam) : 0;
  const cursor = cursorParam ? Number(cursorParam) : undefined;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    return NextResponse.json(
      { error: "Invalid limit parameter." },
      { status: 400 }
    );
  }

  if (offsetParam && (!Number.isInteger(offset) || offset < 0)) {
    return NextResponse.json(
      { error: "Invalid offset parameter." },
      { status: 400 }
    );
  }

  if (cursorParam && (!Number.isInteger(cursor) || cursor! < -1)) {
    return NextResponse.json(
      { error: "Invalid cursor parameter." },
      { status: 400 }
    );
  }

  const rows =
    cursor !== undefined
      ? await getListRowsAfterPosition(listId, cursor, { limit })
      : await getListRows(listId, { limit, offset });

  return NextResponse.json(
    { rows },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
