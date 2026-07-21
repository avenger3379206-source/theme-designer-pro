import type { ReactNode } from "react";
import type { Band, ColorMode, GradientPreset } from "@/lib/gauge-settings";
import { colorFor, gradientColorAt, gradientCss, gradientFillCss } from "@/lib/gauge-settings";

interface MetricBarProps {
  label: ReactNode;
  value: number;
  unit?: string;
  max?: number;
  thresholds?: { warn: number; crit: number };
  bands?: Band[];
  colorMode?: ColorMode;
  gradient?: GradientPreset;
}

export function MetricBar({
  label,
  value,
  unit = "%",
  max = 100,
  thresholds = { warn: 70, crit: 85 },
  bands,
  colorMode = "bands",
  gradient,
}: MetricBarProps) {
  const pct = Math.min(100, (value / max) * 100);
  const frac = value / max;

  let color: string;
  let fill: string;
  if (colorMode === "gradientFill" && gradient) {
    // Show the full gradient spectrum up to the current value
    color = gradientColorAt(gradient, frac);
    fill = gradientFillCss(gradient, Math.max(frac, 0.001), 0);
  } else if (colorMode === "gradient" && gradient) {
    color = gradientColorAt(gradient, frac);
    fill = gradientCss(gradient, 0);
  } else if (bands) {
    color = colorFor(bands, value);
    fill = color;
  } else {
    color = value >= thresholds.crit
      ? "var(--neon-red)"
      : value >= thresholds.warn
        ? "var(--neon-amber)"
        : "var(--neon-cyan)";
    fill = color;
  }

  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground" style={{ color }}>
          {value.toFixed(unit === "GB" ? 1 : 0)}
          {unit}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: fill,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
    </div>
  );
}
