type StatTileProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
  progress?: number | null;
};

const toneVar: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: "var(--color-primary)",
  good: "var(--color-success)",
  warn: "var(--color-warning)",
  bad: "var(--color-destructive)",
};

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  progress = null,
}: StatTileProps) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="stat-value mt-2" style={{ color: toneVar[tone] }}>
        {value}
      </p>
      {progress !== null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              backgroundColor: toneVar[tone],
            }}
          />
        </div>
      )}
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
