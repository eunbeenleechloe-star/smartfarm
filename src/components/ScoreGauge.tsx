export default function ScoreGauge({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div>
      <div className="text-sm font-medium text-muted">{label}</div>
      <div className="mt-1 text-5xl font-bold text-primary">{score}점</div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
    </div>
  );
}
