export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse";
import {
  createDataset,
  datasetExistsByName,
  insertColumns,
  insertRowsBatch,
  type JsonRow,
} from "@/lib/data-access/lists";
import { ReadableStream } from "stream/web";
import { Readable } from "stream";

const BATCH_SIZE = 1000;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as unknown as File | null;
    const name = String(form.get("name") ?? "").trim();

    if (!file || !name) {
      return NextResponse.json(
        { error: "Missing file or name" },
        { status: 400 }
      );
    }

    if (await datasetExistsByName(name)) {
      return NextResponse.json(
        { error: `Dataset "${name}" already exists` },
        { status: 409 }
      );
    }

    const datasetId = await createDataset(name);

    const readable = Readable.fromWeb(
      file.stream() as unknown as ReadableStream
    );

    const parser = parse({
      columns: true,
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });

    const stream = readable.pipe(parser);

    let header: string[] | null = null;
    let columnsInserted = false;

    const batch: JsonRow[] = [];
    const flush = async () => {
      if (batch.length === 0) return;
      await insertRowsBatch(datasetId, batch.splice(0, batch.length));
    };

    for await (const record of stream) {
      if (!columnsInserted) {
        header = Object.keys(record);
        if (header.length === 0) {
          return NextResponse.json(
            { error: "CSV needs a header row" },
            { status: 400 }
          );
        }
        await insertColumns(datasetId, header);
        columnsInserted = true;
      }

      // Normalize one CSV row → JSON row aligned with header
      const j: JsonRow = {};
      for (const key of header!) {
        const v = record[key];
        j[key] = v === "" ? null : v; // keep strings; you can add inference if desired
      }
      batch.push(j);

      if (batch.length >= BATCH_SIZE) {
        await flush();
      }
    }
    await flush(); // Buffer remainder

    return NextResponse.json({ datasetId }, { status: 200 });
  } catch (err: unknown) {
    let message = "Import failed";

    if (err instanceof Error) {
      message = err.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
