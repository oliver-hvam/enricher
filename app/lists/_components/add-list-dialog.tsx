"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <Button type="submit" disabled={loading} className="w-full">
      {loading ? "Uploading..." : "Upload"}
    </Button>
  );
}

export function AddListDialog({
  triggerLabel = "Add list",
}: {
  triggerLabel?: string;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);

  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!file || !name.trim()) {
      setError("Please provide both a name and a CSV file.");
      return;
    }

    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());

      const res = await fetch("/api/lists", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Upload failed");
      }

      // Success → navigate to new list page
      formRef.current?.reset();
      setFile(null);
      setName("");
      setOpen(false);

      router.prefetch(`/lists/${json.listId}`);
      router.push(`/lists/${json.listId}`);
    } catch (err: unknown) {
      let message = "Something went wrong";

      if (err instanceof Error) {
        message = err.message;
      }
      console.error(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload CSV</DialogTitle>
          <DialogDescription>
            Provide an optional name and upload a CSV file with a header row to
            create a new list.
          </DialogDescription>
        </DialogHeader>

        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
          encType="multipart/form-data"
        >
          <div className="space-y-2">
            <Label htmlFor="name">List name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Customer imports"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">CSV file</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground">
              The first row should contain column names. Values are stored as
              text for now.
            </p>
          </div>

          {error && (
            <p className={cn("text-sm font-medium text-destructive", "mt-1")}>
              {error}
            </p>
          )}

          <DialogFooter className="mt-4">
            <SubmitButton loading={loading} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
