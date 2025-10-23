"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
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
import { uploadListAction } from "@/app/lists/actions";
import { cn } from "@/lib/utils";
import { useActionState } from "react";
import { uploadListInitialState, UploadListState } from "../constants";

function SubmitButton({ className }: { className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className}>
      {pending ? "Uploading..." : "Upload"}
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
  const [state, formAction] = useActionState<UploadListState, FormData>(
    uploadListAction,
    uploadListInitialState
  );

  React.useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setOpen(false);
      router.prefetch(`/lists/${state.listId}`);
      router.push(`/lists/${state.listId}`);
    }
  }, [router, state]);

  const errorMessage = state.status === "error" ? state.message : null;

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
          action={formAction}
          className="flex flex-col gap-4"
          encType="multipart/form-data"
        >
          <div className="space-y-2">
            <Label htmlFor="name">List name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Customer imports"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">CSV file</Label>
            <Input id="file" name="file" type="file" accept=".csv" required />
            <p className="text-xs text-muted-foreground">
              The first row should contain column names. Values are stored as
              text for now.
            </p>
          </div>
          {errorMessage ? (
            <p className={cn("text-sm font-medium text-destructive", "mt-1")}>
              {errorMessage}
            </p>
          ) : null}
          <DialogFooter className="mt-4">
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
