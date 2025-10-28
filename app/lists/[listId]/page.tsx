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
    <div className="min-h-full bg-blue-400 flex flex-col">
      <div className="px-8 py-4">
        <ListDetailHeader
          listId={dataset.id}
          name={dataset.name}
          rowCount={dataset.rowCount}
          columnCount={dataset.columns.length}
          updatedAt={dataset.updatedAt}
        />
      </div>
      <div className="max-h-full bg-red-400 overflow-hidden flex-1 flex flex-col">
        {/* <div className="min-h-full bg-green-400 overflow-hidden flex-1">Table</div> */}
      <ListDataTable
        listId={dataset.id}
        columns={dataset.columns.map((c) => ({ id: c.id, name: c.name }))}
        pageSize={50}
      />
      </div>
    </div>
  );
}
