interface ListsHeaderProps {
  actions?: React.ReactNode;
}

export function ListsHeader({ actions }: ListsHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lists</h1>
        <p className="text-sm text-muted-foreground">
          Upload CSV files to create shareable, filterable datasets.
        </p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
