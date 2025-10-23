export type UploadListState =
  | { status: "idle" }
  | { status: "success"; listId: string }
  | { status: "error"; message: string };

const initialState: UploadListState = { status: "idle" };

export { initialState as uploadListInitialState };
