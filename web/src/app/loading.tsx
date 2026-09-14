export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded bg-panel" />
      <div className="h-4 w-96 rounded bg-panel" />
      <div className="grid grid-cols-4 gap-4">
        <div className="h-28 rounded-xl bg-panel" />
        <div className="h-28 rounded-xl bg-panel" />
        <div className="h-28 rounded-xl bg-panel" />
        <div className="h-28 rounded-xl bg-panel" />
      </div>
    </div>
  );
}
