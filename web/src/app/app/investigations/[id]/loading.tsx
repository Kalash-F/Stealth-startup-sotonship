export default function CaseLoading() {
  return (
    <div className="grid gap-4 p-4 lg:p-6" aria-busy="true" aria-label="Loading case">
      <div className="h-6 w-48 rounded-sm bg-surface-2" />
      <div className="h-8 w-2/3 rounded-sm bg-surface-2" />
      <div className="h-40 rounded-md border border-border bg-surface" />
      <div className="h-96 rounded-md border border-border bg-surface" />
    </div>
  );
}
