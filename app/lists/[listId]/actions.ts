"use server";

import { revalidatePath } from "next/cache";

import { AddColumnState } from "./constants";

export async function addColumnAction(
  listId: string,
  _prevState: AddColumnState,
  formData: FormData
): Promise<AddColumnState> {
  try {
    const columnName = formData.get("columnName");

    if (typeof columnName !== "string" || columnName.trim().length === 0) {
      throw new Error("Column name is required");
    }

    revalidatePath(`/lists/${listId}`);

    return { status: "success" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operation failed";
    return { status: "error", message };
  }
}
