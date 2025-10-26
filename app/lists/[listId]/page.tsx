import { ListDetailHeader } from "@/app/lists/[listId]/_components/list-detail-header";
import { ListDataTable } from "@/app/lists/[listId]/_components/list-data-table";

interface ListPageProps {
  params: Promise<{
    listId: string;
  }>;
}

export default async function ListDetailPage({ params }: ListPageProps) {
  const PAGE_SIZE = 50;
  const { listId } = await params;

  /*  return (
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
  );*/
}
