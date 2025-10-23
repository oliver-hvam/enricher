"use client";

import * as React from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableToolbar } from "@/app/lists/[listId]/_components/data-table-toolbar";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ListDataRow {
  id: string;
  values: Record<string, string | null>;
}

export interface ListDataColumn {
  id: string;
  name: string;
}

interface ListDataTableProps {
  columns: ListDataColumn[];
  rows: ListDataRow[];
}

export function ListDataTable({ columns, rows }: ListDataTableProps) {
  const shouldShowPlaceholder = columns.length === 0;
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const columnDefs = React.useMemo<ColumnDef<ListDataRow>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        accessorFn: (row) => row.values[column.id] ?? "",
        header: column.name,
        enableSorting: true,
        cell: ({ getValue }) => {
          const value = getValue<string>();
          if (value === null || value === undefined || value.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return value;
        },
      })),
    [columns]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  });

  if (shouldShowPlaceholder) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        No columns available yet. Add a column to start populating data.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DataTableToolbar table={table} />
      <div className="rounded-lg border">
        <ScrollArea className="max-h-[600px] w-full">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-left font-semibold"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {renderSortIcon(header.column.getIsSorted())}
                        </button>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={Math.max(columns.length, 1)}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}

function renderSortIcon(sortState: false | "asc" | "desc") {
  if (sortState === "asc") {
    return <span aria-hidden="true">↑</span>;
  }
  if (sortState === "desc") {
    return <span aria-hidden="true">↓</span>;
  }
  return null;
}
