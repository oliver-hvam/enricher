"use server";

import { revalidatePath } from "next/cache";

import {
  createListWithDataset,
  type ParsedDataset,
} from "@/lib/data-access/lists";
import { csvToDataset } from "@/lib/csv";
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

    const dataset = await readDatasetFromFile(file);

    const derivedName = extractName(explicitName, file.name);

    const listId = await createListWithDataset(derivedName, dataset);

    revalidatePath("/lists");
    revalidatePath(`/lists/${listId}`);

    return { status: "success", listId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return { status: "error", message };
  }
}

async function readDatasetFromFile(file: File): Promise<ParsedDataset> {
  const text = await file.text();
  return csvToDataset(text);
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
