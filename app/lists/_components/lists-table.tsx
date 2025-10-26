import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DeleteListDialog } from "./delete-list-dialog";

export interface ListSummary {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  createdAt: Date;
}

interface ListsTableProps {
  lists: ListSummary[];
}

export function ListsTable({ lists }: ListsTableProps) {
  if (!lists.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <div className="space-y-2">
          <h2 className="text-lg font-medium">No lists yet</h2>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file to create your first list.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Rows</TableHead>
            <TableHead className="hidden sm:table-cell">Columns</TableHead>
            <TableHead className="hidden sm:table-cell">Created</TableHead>
            <TableHead className="w-[120px]" aria-label="actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lists.map((list) => (
            <TableRow key={list.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{list.name}</span>
                  <span className="text-xs text-muted-foreground sm:hidden">
                    {list.rowCount} rows • {list.columnCount} columns
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden text-sm sm:table-cell">
                {list.rowCount}
              </TableCell>
              <TableCell className="hidden text-sm sm:table-cell">
                {list.columnCount}
              </TableCell>
              <TableCell className="hidden text-sm sm:table-cell">
                {formatDate(list.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/lists/${list.id}`}>Open</Link>
                  </Button>
                  <DeleteListDialog listId={list.id} listName={list.name} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}
