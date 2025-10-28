import { AddColumnDialog } from "@/app/lists/[listId]/_components/add-column-dialog";

interface ListDetailHeaderProps {
  listId: string;
  name: string;
  rowCount: number;
  columnCount: number;
  updatedAt: Date;
}

export function ListDetailHeader({
  listId,
  name,
  rowCount,
  columnCount,
  updatedAt,
}: ListDetailHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">
          {rowCount} rows • {columnCount} columns • Updated {formatRelativeDate(updatedAt)}
        </p>
      </div>
      <AddColumnDialog listId={listId} />
    </div>
  );
}

function formatRelativeDate(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 1000 * 60 * 60 * 24) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
      Math.round(diff / (1000 * 60 * 60)) * -1,
      "hour"
    );
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}
