import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
import { tasks } from "@trigger.dev/sdk";
import { applyTransformation } from "@/trigger/transformations";

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
  const handle = await tasks.trigger<typeof applyTransformation>(
    "apply-transformation",
    {
      transformationId: "86cce0e9-c064-4086-aa14-70edb39cd599",
    }
  );
  return NextResponse.json({ handle });
}
