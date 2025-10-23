"use client";

import { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({ table }: DataTableToolbarProps<TData>) {
  const globalFilter = (table.getState().globalFilter as string) ?? "";
  const isFiltered = globalFilter.length > 0;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Input
        placeholder="Filter rows..."
        value={globalFilter}
        onChange={(event) => table.setGlobalFilter(event.target.value)}
        className="h-9 w-full sm:max-w-sm"
      />
      {isFiltered ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => table.resetGlobalFilter()}
        >
          Reset filters
        </Button>
      ) : null}
    </div>
  );
}
