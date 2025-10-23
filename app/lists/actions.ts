"use server";

import { revalidatePath } from "next/cache";

import { createListFromCsvStream } from "@/lib/data-access/lists";
import { parseCsvStream } from "@/lib/csv";
import { UploadListState } from "./constants";

export async function uploadListAction(
  _prevState: UploadListState,
  formData: FormData
): Promise<UploadListState> {
  try {
    const file = formData.get("file");
    const explicitName = formData.get("name");

    if (!(file instanceof File)) {
      throw new Error("Please select a CSV file to upload");
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      throw new Error("Only .csv files are supported");
    }

    const derivedName = extractName(explicitName, file.name);
    const gen = parseCsvStream(file.stream());
    const first = await gen.next();
    if (first.done || !first.value || first.value.length === 0) {
      throw new Error("CSV file must contain a header row");
    }
    const header = first.value.map((h) => h.trim());
    const listId = await createListFromCsvStream(derivedName, header, gen);

    revalidatePath("/lists");
    revalidatePath(`/lists/${listId}`);

    return { status: "success", listId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return { status: "error", message };
  }
}

function extractName(
  input: FormDataEntryValue | null,
  fallbackFilename: string
) {
  const value = typeof input === "string" ? input.trim() : "";

  if (value.length > 0) {
    return value;
  }

  const withoutExtension = fallbackFilename.replace(/\.csv$/i, "");
  return withoutExtension || "New list";
}
