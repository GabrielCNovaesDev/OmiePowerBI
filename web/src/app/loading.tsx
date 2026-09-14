export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded bg-line" />
      <div className="h-4 w-96 rounded bg-line" />
      <div className="grid grid-cols-4 gap-4">
        <div className="h-28 rounded-md bg-line" />
        <div className="h-28 rounded-md bg-line" />
        <div className="h-28 rounded-md bg-line" />
        <div className="h-28 rounded-md bg-line" />
      </div>
    </div>
  );
}
