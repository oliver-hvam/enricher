export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDatasetWithRows, deleteDataset } from "@/lib/data-access/lists";

interface RouteContext {
  params: Promise<{
    listId: string;
  }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { listId } = await context.params;

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    const options = {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    const dataset = await getDatasetWithRows(listId, options);

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    return NextResponse.json(dataset, { status: 200 });
  } catch (err: unknown) {
    let message = "Failed to fetch dataset";

    if (err instanceof Error) {
      message = err.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { listId } = await context.params;

    const deleted = await deleteDataset(listId);

    if (!deleted) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    let message = "Failed to delete dataset";

    if (err instanceof Error) {
      message = err.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
