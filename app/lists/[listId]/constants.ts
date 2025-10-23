export type AddColumnState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export const addColumnInitialState: AddColumnState = { status: "idle" };
