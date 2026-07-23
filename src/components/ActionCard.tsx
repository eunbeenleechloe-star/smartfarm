export default function ActionCard({
  order,
  action,
}: {
  order: number;
  action: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
        {order}
      </span>
      <p className="text-sm text-text">{action}</p>
    </div>
  );
}
