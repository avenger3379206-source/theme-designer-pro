import { useId } from "react";

export interface InfraSample {
  ms: number;
  ok: boolean;
}

interface Props {
  history: InfraSample[];
  color: string;
  width?: number;
  height?: number;
}

/** Small jagged waveform of recent ping latency, colored by current status. */
export function InfraSparkline({ history, color, width = 130, height = 22 }: Props) {
  const uid = useId().replace(/[:]/g, "");
  const gradId = `spark-${uid}`;

  if (history.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth="1" strokeDasharray="2 3" opacity="0.35" />
      </svg>
    );
  }

  const values = history.map((s) => (s.ok ? s.ms : 0));
  const max = Math.max(...values, 20);
  const min = 0;
  const step = width / (history.length - 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const norm = (v - min) / (max - min || 1);
    const y = height - norm * (height - 4) - 2;
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 2px ${color}88)` }} />
      {history.map((s, i) => {
        if (s.ok) return null;
        const [x, y] = points[i];
        return <circle key={i} cx={x} cy={y} r="1.4" fill="var(--neon-red)" />;
      })}
    </svg>
  );
}
