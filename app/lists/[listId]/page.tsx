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
  const { listId } = await params;

  const list = await getListWithData(listId);

  if (!list) {
    notFound();
  }

  const columns = list.columns.map((column) => ({
    id: column.id,
    name: column.name,
  }));

  const rows = list.rows.map((row) => ({
    id: row.id,
    values: row.values,
  }));

  return (
    <div className="space-y-8">
      <ListDetailHeader
        listId={list.id}
        name={list.name}
        rowCount={list.rows.length}
        columnCount={list.columns.length}
        updatedAt={list.updatedAt}
      />
      <ListDataTable columns={columns} rows={rows} />
    </div>
  );
}
