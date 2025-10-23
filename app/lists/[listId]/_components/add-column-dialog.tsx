"use client";

import { useFormStatus } from "react-dom";

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
import { addColumnAction } from "@/app/lists/[listId]/actions";

import { cn } from "@/lib/utils";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { addColumnInitialState, AddColumnState } from "../constants";

interface AddColumnDialogProps {
  listId: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding..." : "Add column"}
    </Button>
  );
}

export function AddColumnDialog({ listId }: AddColumnDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const action = useMemo(() => addColumnAction.bind(null, listId), [listId]);
  const [state, formAction] = useActionState<AddColumnState, FormData>(
    action,
    addColumnInitialState
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
    }
  }, [state]);

  const errorMessage = state.status === "error" ? state.message : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">New column</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add column</DialogTitle>
          <DialogDescription>
            Define a new column for this list. Existing rows will be populated
            with blank values.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="columnName">Column name</Label>
            <Input
              id="columnName"
              name="columnName"
              placeholder="Status"
              autoComplete="off"
              required
            />
          </div>
          {errorMessage ? (
            <p className={cn("text-sm font-medium text-destructive", "mt-1")}>
              {errorMessage}
            </p>
          ) : null}
          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
