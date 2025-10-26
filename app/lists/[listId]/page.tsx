import { notFound } from "next/navigation";

import { ListDetailHeader } from "@/app/lists/[listId]/_components/list-detail-header";
import { ListDataTable } from "@/app/lists/[listId]/_components/list-data-table";
import { getListWithData } from "@/lib/data-access/lists";

interface ListPageProps {
  params: Promise<{
    listId: string;
  }>;
}

export default async function ListDetailPage({ params }: ListPageProps) {
  const PAGE_SIZE = 50;
  const { listId } = await params;

  const list = await getListWithData(listId, { limit: PAGE_SIZE, offset: 0 });

  if (!list) {
    notFound();
  }

  const columns = list.columns.map((column) => ({
    id: column.id,
    name: column.name,
  }));

  const rows = list.rows.map((row) => ({
    id: row.id,
    position: row.position,
    values: row.values,
  }));

  return (
    <div className="space-y-8">
      <ListDetailHeader
        listId={list.id}
        name={list.name}
        rowCount={list.rowCount}
        columnCount={list.columns.length}
        updatedAt={list.updatedAt}
      />
      <ListDataTable
        listId={list.id}
        columns={columns}
        initialRows={rows}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
