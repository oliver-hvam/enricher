import { AddListDialog } from "@/app/lists/_components/add-list-dialog";
import { ListsHeader } from "@/app/lists/_components/lists-header";
import { ListsTable } from "@/app/lists/_components/lists-table";
import { getAllDatasets } from "@/lib/data-access/lists";

export default async function ListsPage() {
  const lists = await getAllDatasets();

  return (
    <div className="space-y-8">
      <ListsHeader actions={<AddListDialog />} />
      <ListsTable lists={lists} />
    </div>
  );
}
