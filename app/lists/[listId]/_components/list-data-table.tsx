"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnResizeMode,
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  listId: string;
  columns: ListDataColumn[];
  pageSize: number;
}

interface ListRowsResponse {
  rows: ListDataRow[];
  nextCursor?: string | null;
}

export function ListDataTable({
  listId,
  columns,
  pageSize,
}: ListDataTableProps) {
  const [rows, setRows] = React.useState<ListDataRow[]>([]);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const hasMoreRef = React.useRef(true);
  const lastRowIdRef = React.useRef<string | null>(null);
  const isLoadingRef = React.useRef(false);

  const scrollAreaRef = React.useRef<HTMLDivElement | null>(null);
  const sentinelNodeRef = React.useRef<HTMLDivElement | null>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  // ---- Fetch logic ----
  const fetchRows = React.useCallback(
    async (cursor: string | null = null, limit = pageSize) => {
      const cursorParam = cursor ? `cursor=${cursor}&` : "";
      const url = `/api/lists/${listId}/rows?${cursorParam}limit=${limit}`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      return (await response.json()) as ListRowsResponse;
    },
    [listId, pageSize]
  );

  const loadMore = React.useCallback(
    async (force = false) => {
      if (isLoadingRef.current || (!hasMoreRef.current && !force)) return;
      setLoadError(null);
      setIsLoading(true);
      isLoadingRef.current = true;

      try {
        const data = await fetchRows(lastRowIdRef.current);
        const nextRows = Array.isArray(data.rows) ? data.rows : [];

        if (nextRows.length > 0) {
          setRows((prev) => {
            const seen = new Set(prev.map((r) => r.id));
            const deduped = nextRows.filter((r) => !seen.has(r.id));
            return [...prev, ...deduped];
          });

          lastRowIdRef.current =
            data.nextCursor ?? nextRows[nextRows.length - 1]?.id ?? null;

          if (!data.nextCursor || nextRows.length < pageSize) {
            hasMoreRef.current = false;
            setHasMore(false);
          }
        } else {
          hasMoreRef.current = false;
          setHasMore(false);
        }
      } catch (err) {
        console.error("Failed to load rows", err);
        hasMoreRef.current = false;
        setHasMore(false);
        setLoadError("We couldn't load more rows. Try again?");
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    },
    [fetchRows, pageSize]
  );

  // ---- Initial load ----
  React.useEffect(() => {
    void loadMore(true);
  }, [loadMore]);

  // ---- Infinite scroll ----
  const setSentinelNode = React.useCallback((node: HTMLDivElement | null) => {
    sentinelNodeRef.current = node;
  }, []);

  React.useEffect(() => {
    observerRef.current?.disconnect();
    const sentinel = sentinelNodeRef.current;
    const scrollArea = scrollAreaRef.current;
    if (!sentinel || !scrollArea || !hasMoreRef.current) return;

    const viewport = scrollArea.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]"
    );
    if (!viewport) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) void loadMore();
      },
      { root: viewport, rootMargin: "200px" }
    );

    observer.observe(sentinel);
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [loadMore]);

  // ---- Table setup ----
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnSizing, setColumnSizing] = React.useState<
    Record<string, number>
  >({});

  const getDefaultColumnWidth = React.useCallback((columnName: string) => {
    const name = columnName.toLowerCase();
    if (
      name.includes("email") ||
      name.includes("company") ||
      name.includes("address") ||
      name.includes("description")
    )
      return 200;
    if (name.includes("name")) return 150;
    return 250;
  }, []);

  const columnDefs = React.useMemo<ColumnDef<ListDataRow>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        accessorFn: (row) => row.values[column.id] ?? "",
        header: column.name,
        enableSorting: true,
        size: columnSizing[column.id] ?? getDefaultColumnWidth(column.name),
        minSize: 100,
        maxSize: 1000,
        cell: ({ getValue }) => {
          const value = getValue<string>();
          return value?.length ? (
            value
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      })),
    [columns, columnSizing, getDefaultColumnWidth]
  );

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { sorting, globalFilter, columnSizing },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange" as ColumnResizeMode,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  });

  // ---- Render ----
  if (columns.length === 0)
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        No columns yet.
      </div>
    );

  const tableRows = table.getRowModel().rows;

  return (
    <div className="space-y-4">
      <DataTableToolbar table={table} />
      <div className="rounded-lg border">
        <ScrollArea ref={scrollAreaRef} className="h-[70vh] w-full">
          <Table className="w-full" style={{ tableLayout: "fixed" }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <TableHead
                    className="sticky top-0 z-10 w-10 max-w-10 bg-neutral-100 text-center rounded-tl-lg"
                    style={{ borderRight: "1px solid hsl(var(--border))" }}
                  ></TableHead>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "sticky top-0 z-10 bg-neutral-100 border-r border-border last:border-r-0 last:rounded-tr-lg",
                        header.column.getIsResizing() &&
                          "border-r-2 border-primary"
                      )}
                      style={{
                        width: header.getSize(),
                        minWidth: header.column.columnDef.minSize,
                        maxWidth: header.column.columnDef.maxSize,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {tableRows.length ? (
                tableRows.map((row, rowIndex) => {
                  const isLastRow = rowIndex === tableRows.length - 1;
                  return (
                    <TableRow key={row.id} className="h-10">
                      <TableCell
                        className="w-10 max-w-10 select-none text-center text-neutral-400"
                        style={{
                          borderRight: "1px solid hsl(var(--border))",
                          borderBottom: isLastRow
                            ? "1px solid hsl(var(--border))"
                            : undefined,
                        }}
                      >
                        {rowIndex + 1}
                      </TableCell>
                      {row.getVisibleCells().map((cell) => {
                        return (
                          <TableCell
                            key={cell.id}
                            className="cursor-pointer align-top overflow-hidden"
                            style={{
                              width: cell.column.getSize(),
                              minWidth: cell.column.columnDef.minSize,
                              maxWidth: cell.column.columnDef.maxSize,
                              borderRight: "1px solid hsl(var(--border))",
                              borderBottom: isLastRow
                                ? "1px solid hsl(var(--border))"
                                : undefined,
                            }}
                            onClick={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              setActiveCell((prev) => {
                                if (
                                  prev &&
                                  prev.rowId === row.id &&
                                  prev.columnId === cell.column.id
                                ) {
                                  setCellPosition(null);
                                  return null;
                                }
                                setCellPosition({
                                  top: rect.top,
                                  left: rect.left,
                                });
                                return {
                                  rowId: row.id,
                                  columnId: cell.column.id,
                                };
                              });
                            }}
                          >
                            <div
                              className="truncate whitespace-nowrap overflow-hidden text-ellipsis"
                              style={{ maxWidth: "100%" }}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="h-16 text-center text-sm text-muted-foreground"
                  >
                    Loading more rows...
                  </TableCell>
                </TableRow>
              )}
              {loadError && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="h-16 text-center text-sm text-muted-foreground"
                  >
                    <div className="flex justify-center items-center gap-2">
                      {loadError}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void loadMore(true)}
                      >
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div ref={setSentinelNode} className="h-4 w-full" />
        </ScrollArea>
      </div>
      <div className="flex items-center justify-center">
        <Button
          onClick={() => void loadMore(true)}
          disabled={isLoading || !hasMore}
          variant="outline"
          className="w-full sm:w-auto"
        >
          {isLoading ? "Loading..." : hasMore ? "Load more" : "No more rows"}
        </Button>
      </div>
    </div>
  );
}
