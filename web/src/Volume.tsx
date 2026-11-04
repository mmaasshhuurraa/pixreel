interface Props {
  label: string;
  value: number; // 0..2
  onChange: (v: number) => void;
}

/** Volume slider, 0–200 %. */
export default function Volume({ label, value, onChange }: Props) {
  const pct = Math.round(value * 100);
  return (
    <label className="volume">
      <span>{label}</span>
      <output>{pct === 0 ? "🔇 0%" : `${pct}%`}</output>
      <input
        type="range"
        min={0}
        max={200}
        step={5}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onDoubleClick={() => onChange(1)}
        title="100% = original"
      />
    </label>
  );
}
