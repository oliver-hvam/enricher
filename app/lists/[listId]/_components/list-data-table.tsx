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
import { Button } from "@/components/ui/button";

export interface ListDataRow {
  id: string;
  values: Record<string, string | null>;
  position?: number;
}

export interface ListDataColumn {
  id: string;
  name: string;
}

interface ListDataTableProps {
  listId: string;
  columns: ListDataColumn[];
  initialRows: ListDataRow[];
  pageSize: number;
}

interface ListRowsResponse {
  rows: ListDataRow[];
}

export function ListDataTable({
  listId,
  columns,
  initialRows,
  pageSize,
}: ListDataTableProps) {
  const shouldShowPlaceholder = columns.length === 0;
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const [rows, setRows] = React.useState<ListDataRow[]>(initialRows);
  const [hasMore, setHasMore] = React.useState(initialRows.length === pageSize);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const hasMoreRef = React.useRef(initialRows.length === pageSize);
  const lastPositionRef = React.useRef<number>(
    initialRows.length
      ? Math.max(...initialRows.map((r) => r.position ?? -1))
      : -1
  );
  const isLoadingRef = React.useRef(false);
  const scrollAreaRef = React.useRef<HTMLDivElement | null>(null);
  const sentinelNodeRef = React.useRef<HTMLDivElement | null>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  React.useEffect(() => {
    setRows(initialRows);
    const moreAvailable = initialRows.length === pageSize;
    lastPositionRef.current = initialRows.length
      ? Math.max(...initialRows.map((r) => r.position ?? -1))
      : -1;
    hasMoreRef.current = moreAvailable;
    setHasMore(moreAvailable);
  }, [initialRows, pageSize]);

  React.useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  React.useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const loadMore = React.useCallback(
    async (force = false) => {
      if (isLoadingRef.current || (!hasMoreRef.current && !force)) {
        return;
      }

      setLoadError(null);
      setIsLoading(true);
      isLoadingRef.current = true;

      try {
        const cursorParam =
          lastPositionRef.current >= 0
            ? `cursor=${lastPositionRef.current}`
            : "";
        const sep = cursorParam ? "&" : "";
        const url = `/api/lists/${listId}/rows?${cursorParam}${sep}limit=${pageSize}`;
        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = (await response.json()) as ListRowsResponse;
        const nextRows = Array.isArray(data.rows) ? data.rows : [];

        if (nextRows.length > 0) {
          setRows((prev) => [...prev, ...nextRows]);
          const nextMax = Math.max(
            lastPositionRef.current,
            ...nextRows.map((r) => r.position ?? -1)
          );
          lastPositionRef.current = nextMax;

          if (nextRows.length < pageSize) {
            hasMoreRef.current = false;
            setHasMore(false);
          }
        } else {
          hasMoreRef.current = false;
          setHasMore(false);
        }
      } catch (error) {
        console.error("Failed to load more rows", error);
        hasMoreRef.current = false;
        setHasMore(false);
        setLoadError("We couldn't load more rows. Try again?");
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    },
    [listId, pageSize]
  );

  const handleRetry = React.useCallback(() => {
    hasMoreRef.current = true;
    setHasMore(true);
    setLoadError(null);
    void loadMore(true);
  }, [loadMore]);

  const setSentinelNode = React.useCallback((node: HTMLDivElement | null) => {
    sentinelNodeRef.current = node;
  }, []);

  React.useEffect(() => {
    observerRef.current?.disconnect();

    const sentinelNode = sentinelNodeRef.current;
    const scrollArea = scrollAreaRef.current;

    if (!sentinelNode || !scrollArea || !hasMoreRef.current) {
      return;
    }

    const viewport = scrollArea.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]"
    );

    if (!viewport) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          void loadMore();
        }
      },
      { root: viewport, rootMargin: "200px" }
    );

    observer.observe(sentinelNode);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [loadMore, hasMore]);

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

  const tableRows = table.getRowModel().rows;

  return (
    <div className="space-y-4">
      <DataTableToolbar table={table} />
      <div className="rounded-lg border">
        <ScrollArea ref={scrollAreaRef} className="h-[70vh] w-full">
          <div className="w-full">
            <Table className="table-fixed">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    <TableHead className="w-14 text-right">#</TableHead>
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
                {tableRows.length ? (
                  tableRows.map((row, rowIndex) => (
                    <TableRow key={row.id} className="h-10">
                      <TableCell className="w-14 select-none text-right text-muted-foreground">
                        {rowIndex + 1}
                      </TableCell>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="max-w-0">
                          <div className="truncate whitespace-nowrap">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={Math.max(columns.length + 1, 1)}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={Math.max(columns.length + 1, 1)}
                      className="h-16 text-center text-sm text-muted-foreground"
                    >
                      Loading more rows...
                    </TableCell>
                  </TableRow>
                ) : null}
                {loadError ? (
                  <TableRow>
                    <TableCell
                      colSpan={Math.max(columns.length + 1, 1)}
                      className="h-16 text-center text-sm text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                        <span>{loadError}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRetry}
                        >
                          Retry
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <div ref={setSentinelNode} className="h-4 w-full" />
          </div>
        </ScrollArea>
      </div>
      <div className="flex items-center justify-center">
        <Button
          onClick={() => void loadMore(true)}
          disabled={isLoading}
          variant="outline"
          className="w-full sm:w-auto"
        >
          {isLoading ? "Loading..." : "Load more"}
        </Button>
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
