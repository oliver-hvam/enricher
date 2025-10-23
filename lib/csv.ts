// Streaming CSV parser. Handles RFC4180-style CSV with quotes and escaped quotes.
// Yields each parsed row as an array of strings without loading entire file in memory.
export async function* parseCsvStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");

  let inQuotes = false;
  let field = "";
  let row: string[] = [];
  let prevCR = false; // track "\r\n" windows line endings

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (let i = 0; i < chunk.length; i += 1) {
      const ch = chunk[i];
      const next = chunk[i + 1];

      // Handle escaped quotes inside quoted field
      if (ch === '"' && inQuotes && next === '"') {
        field += '"';
        i += 1;
        prevCR = false;
        continue;
      }

      if (ch === '"') {
        inQuotes = !inQuotes;
        prevCR = false;
        continue;
      }

      if (ch === "," && !inQuotes) {
        row.push(field);
        field = "";
        prevCR = false;
        continue;
      }

      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        // Swallow the \n part of a \r\n sequence since we finalize row at \r already
        if (ch === "\n" && prevCR) {
          prevCR = false;
          continue;
        }
        row.push(field);
        field = "";
        if (row.some((cell) => cell.trim().length > 0)) {
          yield row;
        }
        row = [];
        prevCR = ch === "\r";
        continue;
      }

      prevCR = false;
      field += ch;
    }
  }

  // Flush last row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim().length > 0)) {
      yield row;
    }
  }
}
