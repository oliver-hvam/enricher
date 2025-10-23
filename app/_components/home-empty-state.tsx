import { AddListDialog } from "@/app/lists/_components/add-list-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function HomeEmptyState() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Welcome to Enricher</CardTitle>
        <CardDescription>
          Centralize CSV-based lists, enrich them with new columns, and explore
          the data using fast filters and sorting.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Head to the lists workspace or upload a CSV to get started.
        </p>
        <AddListDialog triggerLabel="Upload a CSV" />
      </CardContent>
    </Card>
  );
}
