export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse";
import {
  createDataset,
  datasetExistsByName,
  getAllDatasets,
  insertColumns,
  insertRowsBatch,
  type JsonRow,
} from "@/lib/data-access/lists";
import { Readable } from "stream";

const BATCH_SIZE = 1000;
const SAMPLE_SIZE = 5000; // Read first 5KB to detect delimiter

/**
 * Intelligently detects the CSV delimiter by analyzing a sample of the data.
 * Scores each potential delimiter based on:
 * - Consistency: all rows have the same number of columns
 * - Quality: rows have a reasonable number of columns (> 1)
 * - Reliability: minimal empty fields and consistent parsing
 */
function detectDelimiter(sample: string): string {
  const potentialDelimiters = [",", ";", "\t", "|"];
  const lines = sample
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 10); // Analyze first 10 non-empty lines

  if (lines.length === 0) {
    return ","; // Default fallback
  }

  interface DelimiterScore {
    delimiter: string;
    score: number;
    columnCount: number;
  }

  const scores: DelimiterScore[] = [];

  for (const delimiter of potentialDelimiters) {
    const columnCounts: number[] = [];
    let totalFields = 0;
    let emptyFields = 0;

    for (const line of lines) {
      // Simple split (handles basic cases well)
      const fields = line.split(delimiter);
      columnCounts.push(fields.length);
      totalFields += fields.length;

      // Count empty or whitespace-only fields
      emptyFields += fields.filter((f) => f.trim().length === 0).length;
    }

    // Calculate consistency: all rows should have same column count
    const uniqueCounts = new Set(columnCounts);
    const isConsistent = uniqueCounts.size === 1;
    const avgColumnCount =
      columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;

    // Calculate score
    let score = 0;

    // Consistency is most important (0-100 points)
    if (isConsistent) {
      score += 100;
    } else {
      // Penalize inconsistency
      score += Math.max(0, 100 - uniqueCounts.size * 10);
    }

    // Column count should be reasonable (0-50 points)
    // Too few columns (1) is bad, 2-50 columns is good
    if (avgColumnCount === 1) {
      score -= 50; // Heavy penalty for no actual delimiter
    } else if (avgColumnCount >= 2 && avgColumnCount <= 50) {
      score += 50;
    } else if (avgColumnCount > 50) {
      score += 20; // Many columns might be over-splitting
    }

    // Fewer empty fields is better (0-30 points)
    const emptyRatio = totalFields > 0 ? emptyFields / totalFields : 1;
    score += Math.max(0, 30 - emptyRatio * 30);

    scores.push({
      delimiter,
      score,
      columnCount: avgColumnCount,
    });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Debug logging
  console.log(
    "Delimiter detection scores:",
    scores.map((s) => ({
      delimiter: s.delimiter === "\t" ? "TAB" : s.delimiter,
      score: Math.round(s.score),
      columns: Math.round(s.columnCount),
    }))
  );

  return scores[0].delimiter;
}

export async function GET() {
  try {
    const datasets = await getAllDatasets();
    return NextResponse.json(datasets, { status: 200 });
  } catch (err: unknown) {
    let message = "Failed to fetch datasets";

    if (err instanceof Error) {
      message = err.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    // Read file into buffer to detect delimiter and then parse
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract sample for delimiter detection
    const sampleBuffer = buffer.slice(0, Math.min(SAMPLE_SIZE, buffer.length));
    const sample = sampleBuffer.toString("utf-8");

    // Detect the delimiter
    const detectedDelimiter = detectDelimiter(sample);
    console.log(
      `Detected delimiter: ${
        detectedDelimiter === "\t" ? "TAB" : detectedDelimiter
      }`
    );

    // Create readable stream from buffer
    const readable = Readable.from(buffer);

    const parser = parse({
      columns: true,
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      delimiter: detectedDelimiter,
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
        console.log("Header array:", header);
        console.log("Header length:", header.length);
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

    return NextResponse.json({ listId: datasetId }, { status: 200 });
  } catch (err: unknown) {
    let message = "Import failed";

    if (err instanceof Error) {
      message = err.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
