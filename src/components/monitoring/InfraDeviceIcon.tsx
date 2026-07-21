import { useId } from "react";
import type { InfraHost } from "@/lib/infra-status";

interface Props {
  role: InfraHost["role"];
  /** status color (hex/oklch string) used for the little LED + glow */
  color: string;
  size?: number;
}

/**
 * Small isometric-ish 3D device render, styled after the reference dashboard
 * (rack unit with a glowing LED strip). Shape varies slightly by role so
 * routers/WAN modems read as squat boxes with antennas while servers/
 * switches/NAS read as taller rack towers.
 */
export function InfraDeviceIcon({ role, color, size = 44 }: Props) {
  const uid = useId().replace(/[:]/g, "");
  const tall = role === "server" || role === "switch";
  const bodyGrad = `body-${uid}`;
  const topGrad = `top-${uid}`;
  const sideGrad = `side-${uid}`;

  return (
    <svg
      width={size}
      height={size * 1.5}
      viewBox="0 0 40 60"
      style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
      aria-hidden
    >
      <defs>
        <linearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.32 0.03 260)" />
          <stop offset="100%" stopColor="oklch(0.16 0.03 260)" />
        </linearGradient>
        <linearGradient id={topGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.42 0.035 260)" />
          <stop offset="100%" stopColor="oklch(0.3 0.03 260)" />
        </linearGradient>
        <linearGradient id={sideGrad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.13 0.03 260)" />
          <stop offset="100%" stopColor="oklch(0.08 0.02 260)" />
        </linearGradient>
      </defs>

      {/* antennas for wan/router units */}
      {!tall && (
        <>
          <line x1="10" y1="14" x2="7" y2="4" stroke="oklch(0.5 0.04 260)" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="7" cy="4" r="1.6" fill={color} opacity="0.9" />
          <line x1="20" y1="12" x2="20" y2="3" stroke="oklch(0.5 0.04 260)" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="20" cy="3" r="1.6" fill={color} opacity="0.9" />
        </>
      )}

      {/* top face */}
      <polygon
        points={tall ? "6,10 34,10 30,16 10,16" : "4,14 36,14 31,20 9,20"}
        fill={`url(#${topGrad})`}
        stroke="oklch(0.5 0.04 260 / 0.4)"
        strokeWidth="0.5"
      />
      {/* right side face */}
      <polygon
        points={tall ? "30,16 34,10 34,52 30,58" : "31,20 36,14 36,44 31,50"}
        fill={`url(#${sideGrad})`}
      />
      {/* front face */}
      <rect
        x="10"
        y={tall ? 16 : 20}
        width="20"
        height={tall ? 42 : 30}
        rx="1.5"
        fill={`url(#${bodyGrad})`}
        stroke="oklch(0.5 0.04 260 / 0.35)"
        strokeWidth="0.5"
      />

      {/* vents / slats */}
      {Array.from({ length: tall ? 5 : 3 }).map((_, i) => (
        <rect
          key={i}
          x="12.5"
          y={(tall ? 20 : 23) + i * (tall ? 7.4 : 7)}
          width="15"
          height="2.2"
          rx="1.1"
          fill="oklch(0.4 0.03 260 / 0.55)"
        />
      ))}

      {/* status LED */}
      <circle
        cx="26"
        cy={tall ? 55 : 46}
        r="1.7"
        fill={color}
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
    </svg>
  );
}
