import { ParsedDataset } from "@/lib/data-access/lists";

export function parseCsv(content: string): string[][] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === "\"" && inQuotes && nextChar === "\"") {
      currentField += "\"";
      i += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

export function csvToDataset(csv: string): ParsedDataset {
  const rows = parseCsv(csv);

  if (!rows.length) {
    throw new Error("CSV file must contain at least one row");
  }

  const [header, ...dataRows] = rows;

  if (!header.length) {
    throw new Error("CSV header row is empty");
  }

  return {
    columns: header.map((column) => column.trim()),
    rows: dataRows,
  };
}
