import { ListDetailHeader } from "@/app/lists/[listId]/_components/list-detail-header";
import {
  ListDataTable,
  ListDataColumn,
  ListDataRow,
} from "@/app/lists/[listId]/_components/list-data-table";
import { getDatasetWithRows } from "@/lib/data-access/lists";
import { notFound } from "next/navigation";

interface ListPageProps {
  params: Promise<{
    listId: string;
  }>;
}

export default async function ListDetailPage({ params }: ListPageProps) {
  const PAGE_SIZE = 50;
  const { listId } = await params;

  const dataset = await getDatasetWithRows(listId, {
    limit: PAGE_SIZE,
    offset: 0,
  });

  if (!dataset) {
    notFound();
  }

  // Create a map from column name to column ID
  const columnNameToId = new Map(
    dataset.columns.map((col) => [col.name, col.id])
  );

  // Transform columns to the format expected by ListDataTable
  const columns: ListDataColumn[] = dataset.columns.map((col) => ({
    id: col.id,
    name: col.name,
  }));

  // Transform rows: convert from column-name-keyed to column-id-keyed
  const rows: ListDataRow[] = dataset.rows.map((row, index) => {
    const values: Record<string, string | null> = {};

    for (const [columnName, value] of Object.entries(row.row)) {
      const columnId = columnNameToId.get(columnName);
      if (columnId) {
        values[columnId] = value as string | null;
      }
    }

    return {
      id: row.id,
      values,
      position: index, // Use index as position since we don't have it in schema
    };
  });

  return (
    <div>
      <div className="px-8 py-4">
      <ListDetailHeader
        listId={dataset.id}
        name={dataset.name}
        rowCount={dataset.rowCount}
        columnCount={dataset.columns.length}
        updatedAt={dataset.updatedAt}
      /></div>
      <ListDataTable
        listId={dataset.id}
        columns={columns}
        initialRows={rows}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
