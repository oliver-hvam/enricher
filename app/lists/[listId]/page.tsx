import { ListDetailHeader } from "@/app/lists/[listId]/_components/list-detail-header";
import { ListDataTable } from "@/app/lists/[listId]/_components/list-data-table";
import { notFound } from "next/navigation";
import { getDatasetWithColumnsOnly } from "@/lib/data-access/lists";

interface ListPageProps {
  params: Promise<{ listId: string }>;
}

export default async function ListDetailPage({ params }: ListPageProps) {
  const { listId } = await params;

  const dataset = await getDatasetWithColumnsOnly(listId);

  if (!dataset) notFound();

  return (
    <div className="space-y-8">
      <ListDetailHeader
        listId={dataset.id}
        name={dataset.name}
        rowCount={dataset.rowCount}
        columnCount={dataset.columns.length}
        updatedAt={dataset.updatedAt}
      />
      {/* ⬇ Client handles fetching rows */}
      <ListDataTable
        listId={dataset.id}
        columns={dataset.columns.map((c) => ({ id: c.id, name: c.name }))}
        pageSize={50}
      />
    </div>
  );
}
