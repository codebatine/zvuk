interface Props {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (v: number) => void;
}

export function ZvukSlider({ label, low, high, value, onChange }: Props) {
  return (
    <div className="group">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] tracking-[0.28em] text-foreground/80">{label}</span>
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground">
          {low} — {high}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="zvuk-range"
        style={{ ["--pct" as string]: `${value * 100}%` }}
      />
    </div>
  );
}
