import type { LucideIcon } from "lucide-react";
import type { Band, GaugeShape, ColorMode, GradientPreset } from "@/lib/gauge-settings";
import { colorFor, gradientColorAt } from "@/lib/gauge-settings";

interface Props {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  size?: number;
  bands?: Band[];
  icon?: LucideIcon;
  shape?: GaugeShape;
  colorMode?: ColorMode;
  gradient?: GradientPreset;
  strokeWidth?: number;
}

const FALLBACK_BANDS: Band[] = [
  { max: 60, color: "#22d3ee" },
  { max: 75, color: "#facc15" },
  { max: 100, color: "#ef4444" },
];

/** Regular polygon points inscribed in a circle of radius r centered at (cx, cy). */
function polygonPoints(sides: number, cx: number, cy: number, r: number, rotation = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** Perimeter for a regular polygon with given side count and circumradius. */
function polygonPerimeter(sides: number, r: number): number {
  return 2 * r * Math.sin(Math.PI / sides) * sides;
}

/** Number of gradient segments for gradientFill mode — enough for smooth color transitions. */
const GRADIENT_SEGMENTS = 24;

export function CircularGauge({
  value,
  max = 100,
  label,
  unit = "°",
  size = 64,
  bands,
  icon: Icon,
  shape = "circle",
  colorMode = "bands",
  gradient,
  strokeWidth = 4,
}: Props) {
  const pct = Math.max(0, Math.min(1, value / max));
  const useBands = bands ?? FALLBACK_BANDS;
  const frac = value / max;

  const isGradientFill = colorMode === "gradientFill" && gradient;
  const isGradient = colorMode === "gradient" && gradient;

  const color = isGradient
    ? gradientColorAt(gradient!, frac)
    : colorFor(useBands, value);

  const sw = strokeWidth;

  // Needle gauge: custom layout — arc + needle + value below the pivot
  if (shape === "needle") {
    return (
      <div className="relative flex flex-col items-center" style={{ width: size }}>
        <NeedleGauge
          value={value}
          max={max}
          size={size}
          pct={pct}
          stroke={color}
          glowColor={color}
          strokeWidth={sw}
          gradient={isGradientFill ? gradient : undefined}
        />
        <div className="pointer-events-none mt-0.5 flex flex-col items-center leading-none">
          {Icon && (
            <Icon
              size={Math.max(9, Math.round(size * 0.14))}
              color={color}
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
          )}
          <span
            className="font-mono font-bold leading-none"
            style={{ color, textShadow: `0 0 6px ${color}66`, fontSize: Math.max(12, Math.round(size * 0.22)) }}
          >
            {value.toFixed(0)}
            <span className="text-[8px] opacity-80">{unit}</span>
          </span>
          <span className="font-mono text-[8px] font-semibold uppercase tracking-wider text-foreground/70">
            {label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <GaugeShape
        shape={shape}
        size={size}
        pct={pct}
        stroke={color}
        glowColor={color}
        strokeWidth={sw}
        gradient={isGradientFill ? gradient : undefined}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
        {Icon && (
          <Icon
            size={Math.max(9, Math.round(size * 0.16))}
            color={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        )}
        <span
          className="font-mono font-bold leading-none"
          style={{ color, textShadow: `0 0 6px ${color}66`, fontSize: Math.max(12, Math.round(size * 0.24)) }}
        >
          {value.toFixed(0)}
          <span className="text-[8px] opacity-80">{unit}</span>
        </span>
        <span className="font-mono text-[8px] font-semibold uppercase tracking-wider text-foreground/70">
          {label}
        </span>
      </div>
    </div>
  );
}

interface ShapeProps {
  shape: GaugeShape;
  size: number;
  pct: number;
  stroke: string;
  glowColor: string;
  strokeWidth: number;
  gradient?: GradientPreset;
}

function GaugeShape({ shape, size, pct, stroke, glowColor, strokeWidth, gradient }: ShapeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth * 2) / 2;
  const sw = strokeWidth;

  // LINE: horizontal bar
  if (shape === "line") {
    const barH = Math.max(sw, 6);
    const barY = cy - barH / 2;
    const fillW = (size - 4) * pct;

    if (gradient) {
      // Gradient fill: show full spectrum up to current value
      const stops = [...gradient.stops].sort((a, b) => a.at - b.at);
      const parts = stops.map((s) => {
        const pos = Math.min(100, (s.at / Math.max(pct, 0.001)) * 100);
        return `${s.color} ${pos.toFixed(1)}%`;
      });
      const fillGradient = `linear-gradient(90deg, ${parts.join(", ")})`;
      return (
        <svg width={size} height={size} className="overflow-visible">
          <rect x={2} y={barY} width={size - 4} height={barH} rx={barH / 2} fill="oklch(0.3 0.04 260 / 0.6)" />
          <rect
            x={2}
            y={barY}
            width={fillW}
            height={barH}
            rx={barH / 2}
            fill="url(#none)"
            style={{
              fill: fillGradient,
              filter: `drop-shadow(0 0 6px ${glowColor})`,
              transition: "width 600ms ease",
            }}
          />
        </svg>
      );
    }

    return (
      <svg width={size} height={size} className="overflow-visible">
        <rect x={2} y={barY} width={size - 4} height={barH} rx={barH / 2} fill="oklch(0.3 0.04 260 / 0.6)" />
        <rect
          x={2}
          y={barY}
          width={fillW}
          height={barH}
          rx={barH / 2}
          fill={stroke}
          style={{
            filter: `drop-shadow(0 0 6px ${glowColor})`,
            transition: "width 600ms ease, fill 300ms ease",
          }}
        />
      </svg>
    );
  }

  // SEMICIRCLE: half-arc at top
  if (shape === "semicircle") {
    const halfR = r;
    const circ = Math.PI * halfR;
    const offset = circ * (1 - pct);

    if (gradient) {
      return (
        <svg width={size} height={size / 2 + 6} className="overflow-visible">
          <path
            d={`M ${cx - halfR} ${cy} A ${halfR} ${halfR} 0 0 1 ${cx + halfR} ${cy}`}
            stroke="oklch(0.3 0.04 260 / 0.6)"
            strokeWidth={sw}
            strokeLinecap="round"
            fill="none"
          />
          {renderArcSegments(GRADIENT_SEGMENTS, pct, (startFrac, endFrac) => {
            const midFrac = (startFrac + endFrac) / 2;
            const segColor = gradientColorAt(gradient, midFrac);
            const startA = Math.PI + startFrac * Math.PI;
            const endA = Math.PI + endFrac * Math.PI;
            const x1 = cx + halfR * Math.cos(startA);
            const y1 = cy + halfR * Math.sin(startA);
            const x2 = cx + halfR * Math.cos(endA);
            const y2 = cy + halfR * Math.sin(endA);
            return (
              <path
                key={startFrac}
                d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${halfR} ${halfR} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`}
                stroke={segColor}
                strokeWidth={sw}
                strokeLinecap="butt"
                fill="none"
                style={{ transition: "opacity 300ms ease" }}
              />
            );
          })}
        </svg>
      );
    }

    return (
      <svg width={size} height={size / 2 + 6} className="overflow-visible">
        <path
          d={`M ${cx - halfR} ${cy} A ${halfR} ${halfR} 0 0 1 ${cx + halfR} ${cy}`}
          stroke="oklch(0.3 0.04 260 / 0.6)"
          strokeWidth={sw}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={`M ${cx - halfR} ${cy} A ${halfR} ${halfR} 0 0 1 ${cx + halfR} ${cy}`}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 6px ${glowColor})`,
            transition: "stroke-dashoffset 600ms ease, stroke 300ms ease",
          }}
        />
      </svg>
    );
  }

  // POLYGON shapes: octagon, hexagon, triangle, square, circle
  let sides = 0;
  let rotation = 0;
  switch (shape) {
    case "octagon": sides = 8; rotation = Math.PI / 8; break;
    case "hexagon": sides = 6; rotation = 0; break;
    case "triangle": sides = 3; rotation = 0; break;
    case "square": sides = 4; rotation = Math.PI / 4; break;
    case "circle":
    default:
      sides = 0; break;
  }

  // Circle: arc-based rendering
  if (sides === 0) {
    const c = 2 * Math.PI * r;
    const offset = c * (1 - pct);

    if (gradient) {
      return (
        <svg width={size} height={size} className="-rotate-90 overflow-visible">
          <circle cx={cx} cy={cy} r={r} stroke="oklch(0.3 0.04 260 / 0.6)" strokeWidth={sw} fill="none" />
          {renderArcSegments(GRADIENT_SEGMENTS, pct, (startFrac, endFrac) => {
            const midFrac = (startFrac + endFrac) / 2;
            const segColor = gradientColorAt(gradient, midFrac);
            const segLen = (endFrac - startFrac) * c;
            const segOffset = c - startFrac * c;
            return (
              <circle
                key={startFrac}
                cx={cx}
                cy={cy}
                r={r}
                stroke={segColor}
                strokeWidth={sw}
                strokeLinecap="butt"
                fill="none"
                strokeDasharray={`${segLen} ${c}`}
                strokeDashoffset={segOffset}
                style={{ transition: "opacity 300ms ease" }}
              />
            );
          })}
        </svg>
      );
    }

    return (
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        <circle cx={cx} cy={cy} r={r} stroke="oklch(0.3 0.04 260 / 0.6)" strokeWidth={sw} fill="none" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 6px ${glowColor})`,
            transition: "stroke-dashoffset 600ms ease, stroke 300ms ease",
          }}
        />
      </svg>
    );
  }

  // Polygon: stroke-dasharray on a polygon outline
  const polyR = r;
  const points = polygonPoints(sides, cx, cy, polyR, rotation);
  const perim = polygonPerimeter(sides, polyR);
  const offset = perim * (1 - pct);

  if (gradient) {
    return (
      <svg width={size} height={size} className="overflow-visible">
        <polygon
          points={points}
          stroke="oklch(0.3 0.04 260 / 0.6)"
          strokeWidth={sw}
          strokeLinejoin="round"
          fill="none"
        />
        {renderArcSegments(GRADIENT_SEGMENTS, pct, (startFrac, endFrac) => {
          const midFrac = (startFrac + endFrac) / 2;
          const segColor = gradientColorAt(gradient, midFrac);
          const segLen = (endFrac - startFrac) * perim;
          const segOffset = perim - startFrac * perim;
          return (
            <polygon
              key={startFrac}
              points={points}
              stroke={segColor}
              strokeWidth={sw}
              strokeLinejoin="round"
              strokeLinecap="butt"
              fill="none"
              strokeDasharray={`${segLen} ${perim}`}
              strokeDashoffset={segOffset}
              style={{ transition: "opacity 300ms ease" }}
            />
          );
        })}
      </svg>
    );
  }

  return (
    <svg width={size} height={size} className="overflow-visible">
      <polygon
        points={points}
        stroke="oklch(0.3 0.04 260 / 0.6)"
        strokeWidth={sw}
        strokeLinejoin="round"
        fill="none"
      />
      <polygon
        points={points}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={perim}
        strokeDashoffset={offset}
        style={{
          filter: `drop-shadow(0 0 6px ${glowColor})`,
          transition: "stroke-dashoffset 600ms ease, stroke 300ms ease",
        }}
      />
    </svg>
  );
}

/** Render N arc segments up to pct. Each segment gets its own color from the gradient. */
function renderArcSegments(
  segments: number,
  pct: number,
  render: (startFrac: number, endFrac: number) => React.ReactNode,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const visibleSegs = Math.ceil(segments * pct);
  for (let i = 0; i < visibleSegs; i++) {
    const startFrac = i / segments;
    const endFrac = Math.min((i + 1) / segments, pct);
    result.push(render(startFrac, endFrac));
  }
  return result;
}

interface NeedleProps {
  value: number;
  max: number;
  size: number;
  pct: number;
  stroke: string;
  glowColor: string;
  strokeWidth: number;
  gradient?: GradientPreset;
}

/**
 * Speedometer-style needle gauge. A 240° background arc with a colored fill
 * arc up to the current value, and a needle pointer that rotates to point at
 * the current value. The needle's pivot is at the bottom-center of the arc;
 * the numeric value is rendered below the pivot by the parent (CircularGauge).
 */
function NeedleGauge({ value, max, size, pct, stroke, glowColor, strokeWidth, gradient }: NeedleProps) {
  const cx = size / 2;
  // Arc spans 240°, centered at the bottom (gap at the bottom-center).
  const startAngle = 150; // degrees, measured clockwise from positive x-axis
  const endAngle = 30 + 360; // wrap past 360 so we sweep 240°
  const sweep = endAngle - startAngle; // 240
  const r = (size - strokeWidth * 2) / 2;
  const cy = size / 2;
  const sw = Math.max(2, strokeWidth);

  // Needle angle in degrees (clockwise from positive x-axis)
  const needleAngle = startAngle + pct * sweep;

  // Convert polar (angle in degrees, radius r) to cartesian
  const polar = (angleDeg: number, radius: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  };

  const arcPath = (fromDeg: number, toDeg: number) => {
    const from = polar(fromDeg, r);
    const to = polar(toDeg, r);
    const large = toDeg - fromDeg > 180 ? 1 : 0;
    return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  };

  const bgStart = polar(startAngle, r);
  const bgEnd = polar(endAngle, r);

  // Tick marks (small) every 10% — 11 ticks total
  const tickMarks: React.ReactNode[] = [];
  for (let i = 0; i <= 10; i++) {
    const tickFrac = i / 10;
    const tickAngle = startAngle + tickFrac * sweep;
    const outer = polar(tickAngle, r - sw / 2 - 1);
    const inner = polar(tickAngle, r - sw / 2 - 4);
    const isMajor = i % 5 === 0;
    tickMarks.push(
      <line
        key={i}
        x1={outer.x}
        y1={outer.y}
        x2={inner.x}
        y2={inner.y}
        stroke={isMajor ? "oklch(0.7 0.04 260 / 0.7)" : "oklch(0.5 0.04 260 / 0.5)"}
        strokeWidth={isMajor ? 1.2 : 0.6}
        strokeLinecap="round"
      />,
    );
  }

  // Needle tip + tail
  const needleLen = r - sw - 2;
  const needleTip = polar(needleAngle, needleLen);
  const needleTail = polar(needleAngle + 180, Math.max(3, r * 0.18));

  return (
    <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`} className="overflow-visible">
      {/* Background arc */}
      <path
        d={arcPath(startAngle, endAngle)}
        stroke="oklch(0.3 0.04 260 / 0.6)"
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />
      {/* Fill arc (colored portion up to current value) */}
      {gradient ? (
        renderArcSegments(GRADIENT_SEGMENTS, pct, (startFrac, endFrac) => {
          const midFrac = (startFrac + endFrac) / 2;
          const segColor = gradientColorAt(gradient, midFrac);
          const fromA = startAngle + startFrac * sweep;
          const toA = startAngle + endFrac * sweep;
          return (
            <path
              key={startFrac}
              d={arcPath(fromA, toA)}
              stroke={segColor}
              strokeWidth={sw}
              strokeLinecap="butt"
              fill="none"
              style={{ transition: "opacity 300ms ease" }}
            />
          );
        })
      ) : (
        <path
          d={arcPath(startAngle, startAngle + pct * sweep)}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          fill="none"
          style={{
            filter: `drop-shadow(0 0 6px ${glowColor})`,
            transition: "stroke-dashoffset 600ms ease, stroke 300ms ease",
          }}
        />
      )}
      {/* Tick marks */}
      {tickMarks}
      {/* Needle */}
      <g
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          transform: `rotate(${needleAngle - 90}deg)`,
          transition: "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Needle body */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + needleLen}
          y2={cy}
          stroke={stroke}
          strokeWidth={Math.max(1.5, sw * 0.35)}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
        />
        {/* Needle tail (small counterweight) */}
        <line
          x1={cx}
          y1={cy}
          x2={cx - Math.max(3, r * 0.18)}
          y2={cy}
          stroke="oklch(0.5 0.04 260)"
          strokeWidth={Math.max(1.5, sw * 0.3)}
          strokeLinecap="round"
        />
      </g>
      {/* Pivot circle */}
      <circle
        cx={cx}
        cy={cy}
        r={Math.max(2.5, sw * 0.6)}
        fill={stroke}
        stroke="oklch(0.15 0.02 260)"
        strokeWidth={1}
        style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
      />
    </svg>
  );
}
