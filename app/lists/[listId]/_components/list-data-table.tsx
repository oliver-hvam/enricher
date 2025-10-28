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

  const [cellPosition, setCellPosition] = React.useState<{
    top: number;
    left: number;
  } | null>(null);

  const popupRef = React.useRef<HTMLDivElement | null>(null);

  // Close popup when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        // Only close if not clicking on a table cell
        const target = event.target as HTMLElement;
        if (!target.closest("td")) {
          setActiveCell(null);
          setCellPosition(null);
        }
      }
    }

    if (activeCell) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeCell]);

  const getDefaultColumnWidth = React.useCallback((columnName: string) => {
    const name = (columnName || "").toLowerCase();
    if (
      name.includes("first name") ||
      name.includes("last name") ||
      name === "first" ||
      name === "last" ||
      name == "full name" ||
      "fullname"
    ) {
      return 150;
    } else if (
      name.includes("email") ||
      name.includes("company") ||
      name.includes("address") ||
      name.includes("notes") ||
      name.includes("description") ||
      name.includes("title")
    ) {
      return 200;
    }
    return 250;
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

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          void loadMore();
        }
      },
      { root: scrollArea, rootMargin: "200px" }
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

  const rounding = "none";

  if (shouldShowPlaceholder) {
    return (
      <div className={cn("border border-dashed p-12 text-center text-sm text-muted-foreground", `rounded-${rounding}`)}>
        No columns available yet. Add a column to start populating data.
      </div>
    );
  }

  const tableRows = table.getRowModel().rows;

  return (
    <div className="space-y-4 max-w-full w-full">
      <DataTableToolbar table={table} />
      <div className={cn("border-t border-b", `rounded-${rounding}`)}>
        <div ref={scrollAreaRef} className="h-[70vh] overflow-x-auto overflow-y-auto" >
          <Table style={{ tableLayout: "fixed" }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <TableHead
                    className={cn("sticky top-0 z-10 w-10 max-w-10 bg-neutral-100 text-center", `rounded-tl-${rounding}`)}
                    style={{ borderRight: "1px solid hsl(var(--border))" }}
                  ></TableHead>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "sticky top-0 z-10 bg-neutral-100 border-r border-border last:border-r-0",
                        `last:rounded-tr-${rounding}`,
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
              {!isLoading && !loadError && hasMore ? (
                <TableRow>
                  <TableCell
                    colSpan={Math.max(columns.length + 1, 1)}
                    className="h-16 text-center"
                  >
                    <div className="flex items-center justify-center">
                      <Button
                        onClick={() => void loadMore(true)}
                        disabled={isLoading}
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        Load more
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <div ref={setSentinelNode} className="h-4 w-full" />
        </div>
      </div>
      {activeCell && cellPosition && (
        <div
          ref={popupRef}
          className="fixed z-50 border border-neutral-700 shadow-lg"
          style={{
            top: `${cellPosition.top}px`,
            left: `${cellPosition.left}px`,
            width: "400px",
            maxHeight: "300px",
          }}
        >
          <ExpandedReadOnlyTextArea
            value={
              rows.find((r) => r.id === activeCell.rowId)?.values[
                activeCell.columnId
              ] || ""
            }
          />
        </div>
      )}
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
    const scrollHeight = el.scrollHeight;
    const maxHeight = 300 - 16; // Account for padding
    el.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    el.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value]);

  return (
    <textarea
      ref={textAreaRef}
      readOnly
      value={value}
      rows={1}
      className="block w-full resize-none whitespace-pre-wrap wrap-break-word rounded-md bg-background px-3 py-2 text-sm focus:outline-none"
    />
  );
}
