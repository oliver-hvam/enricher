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

  // Column sizing state
  const [columnSizing, setColumnSizing] = React.useState<
    Record<string, number>
  >({});

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

  const [activeCell, setActiveCell] = React.useState<{
    rowId: string;
    columnId: string;
  } | null>(null);

  const getDefaultColumnWidth = React.useCallback((columnName: string) => {
    const name = (columnName || "").toLowerCase();
    if (
      name.includes("first name") ||
      name.includes("last name") ||
      name === "first" ||
      name === "last"
    ) {
      return 200;
    } else if (
      name.includes("email") ||
      name.includes("company") ||
      name.includes("address") ||
      name.includes("notes") ||
      name.includes("description") ||
      name.includes("title")
    ) {
      return 420;
    }
    return 320;
  }, []);

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
      columns.map((column) => {
        const defaultWidth = getDefaultColumnWidth(column.name);
        return {
          id: column.id,
          accessorFn: (row) => row.values[column.id] ?? "",
          header: column.name,
          enableSorting: true,
          size: columnSizing[column.id] ?? defaultWidth,
          minSize: 100,
          maxSize: 1000,
          cell: ({ getValue }) => {
            const value = getValue<string>();
            if (value === null || value === undefined || value.length === 0) {
              return <span className="text-muted-foreground">—</span>;
            }
            return value;
          },
        };
      }),
    [columns, columnSizing, getDefaultColumnWidth]
  );

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: {
      sorting,
      globalFilter,
      columnSizing,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange" as ColumnResizeMode,
    enableColumnResizing: true,
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
    <div className="space-y-4 ">
      <DataTableToolbar table={table} />
      <div className="rounded-lg border ">
        <ScrollArea ref={scrollAreaRef} className="h-[70vh] w-full">
          <Table className="w-max min-w-full" style={{ tableLayout: "fixed" }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <TableHead
                    className="sticky top-0 z-10 w-14 bg-neutral-100 text-right rounded-tl-lg"
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
                        position: "sticky",
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <>
                          <div className="flex items-center">
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
                          </div>
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              "absolute right-[-2px] top-0 bottom-0 w-[8px] cursor-col-resize select-none touch-none   hover:border-r-2 border-neutral-500 transition-colors",
                              header.column.getIsResizing() &&
                                "z-20  hover:border-r-2"
                            )}
                            aria-label="Resize column"
                          />
                        </>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {tableRows.length ? (
                tableRows.map((row, rowIndex) => {
                  const isRowExpanded =
                    activeCell !== null && activeCell.rowId === row.id;
                  return (
                    <TableRow
                      key={row.id}
                      className={cn(!isRowExpanded && "h-10")}
                    >
                      <TableCell
                        className="w-14 select-none text-right text-muted-foreground"
                        style={{ borderRight: "1px solid hsl(var(--border))" }}
                      >
                        {rowIndex + 1}
                      </TableCell>
                      {row.getVisibleCells().map((cell) => {
                        const isActive =
                          activeCell !== null &&
                          activeCell.rowId === row.id &&
                          activeCell.columnId === cell.column.id;
                        const rawValue = (cell.getValue<string>() ||
                          "") as string;
                        return (
                          <TableCell
                            key={cell.id}
                            className="cursor-pointer align-top"
                            style={{
                              width: cell.column.getSize(),
                              minWidth: cell.column.columnDef.minSize,
                              maxWidth: cell.column.columnDef.maxSize,
                              borderRight: "1px solid hsl(var(--border))",
                            }}
                            onClick={() =>
                              setActiveCell((prev) => {
                                if (
                                  prev &&
                                  prev.rowId === row.id &&
                                  prev.columnId === cell.column.id
                                ) {
                                  return null;
                                }
                                return {
                                  rowId: row.id,
                                  columnId: cell.column.id,
                                };
                              })
                            }
                          >
                            {isActive ? (
                              <div className="rounded-md ring-2 ring-primary">
                                <ExpandedReadOnlyTextArea value={rawValue} />
                              </div>
                            ) : (
                              <div className="truncate whitespace-nowrap">
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
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
                      <Button variant="outline" size="sm" onClick={handleRetry}>
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <div ref={setSentinelNode} className="h-4 w-full" />
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

function ExpandedReadOnlyTextArea({ value }: { value: string }) {
  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useLayoutEffect(() => {
    const el = textAreaRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={textAreaRef}
      readOnly
      value={value}
      rows={1}
      className="block w-full resize-none overflow-hidden whitespace-pre-wrap wrap-break-word rounded-md border border-primary/60 bg-background px-2 py-1 text-sm focus:outline-none"
    />
  );
}
