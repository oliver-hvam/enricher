export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const backoffMs = (attempt: number, baseMs = 1000, maxMs = 8000) =>
  Math.min(baseMs * 2 ** (attempt - 1), maxMs);
