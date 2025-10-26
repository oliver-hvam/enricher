import { AddListDialog } from "@/app/lists/_components/add-list-dialog";
import { ListsHeader } from "@/app/lists/_components/lists-header";
import { ListsTable } from "@/app/lists/_components/lists-table";

export default async function ListsPage() {
  //const lists = await getLists();

  return (
    <div className="space-y-8">
      <ListsHeader actions={<AddListDialog />} />
      <ListsTable lists={lists} />
    </div>
  );
}
