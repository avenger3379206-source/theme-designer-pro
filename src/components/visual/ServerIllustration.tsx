/**
 * Isometric server rack illustration drawn entirely in SVG so it inherits
 * theme colors via CSS variables. No external assets required.
 */
export function ServerIllustration({ className }: { className?: string }) {
  const cyan = "var(--neon-cyan)";
  const magenta = "var(--neon-magenta)";
  const green = "var(--neon-green)";

  return (
    <svg
      viewBox="0 0 200 240"
      className={className}
      role="img"
      aria-label="Server rack illustration"
    >
      <defs>
        <linearGradient id="srv-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.28 0.05 255)" />
          <stop offset="100%" stopColor="oklch(0.16 0.04 255)" />
        </linearGradient>
        <linearGradient id="srv-panel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.2 0.04 255)" />
          <stop offset="100%" stopColor="oklch(0.12 0.03 255)" />
        </linearGradient>
        <radialGradient id="srv-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={cyan} stopOpacity="0.55" />
          <stop offset="60%" stopColor={cyan} stopOpacity="0.12" />
          <stop offset="100%" stopColor={cyan} stopOpacity="0" />
        </radialGradient>
        <filter id="srv-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* halo base */}
      <ellipse cx="100" cy="222" rx="78" ry="14" fill="url(#srv-glow)" />
      <ellipse cx="100" cy="222" rx="52" ry="8" fill={cyan} opacity="0.25" filter="url(#srv-blur)" />

      {/* isometric rack — 4 stacked units */}
      {Array.from({ length: 4 }).map((_, i) => {
        const y = 40 + i * 38;
        return (
          <g key={i} transform={`translate(0 ${i * 4})`}>
            {/* top face */}
            <polygon
              points={`40,${y} 160,${y} 180,${y - 14} 60,${y - 14}`}
              fill="oklch(0.32 0.05 255)"
              opacity="0.9"
            />
            {/* front face */}
            <polygon
              points={`40,${y} 160,${y} 160,${y + 30} 40,${y + 30}`}
              fill="url(#srv-body)"
              stroke={cyan}
              strokeOpacity="0.25"
              strokeWidth="0.6"
            />
            {/* right side */}
            <polygon
              points={`160,${y} 180,${y - 14} 180,${y + 16} 160,${y + 30}`}
              fill="url(#srv-panel)"
            />
            {/* LED row */}
            {Array.from({ length: 5 }).map((_, j) => {
              const ledColor = j === 2 ? magenta : j === 4 ? green : cyan;
              const blink = (i + j) % 2 === 0 ? "animate-pulse" : "";
              return (
                <circle
                  key={j}
                  cx={52 + j * 12}
                  cy={y + 10}
                  r="1.8"
                  fill={ledColor}
                  className={blink}
                  style={{ filter: `drop-shadow(0 0 3px ${ledColor})` }}
                />
              );
            })}
            {/* vent lines */}
            <line x1="52" y1={y + 20} x2="148" y2={y + 20} stroke={cyan} strokeOpacity="0.15" strokeWidth="0.5" />
            <line x1="52" y1={y + 24} x2="148" y2={y + 24} stroke={cyan} strokeOpacity="0.1" strokeWidth="0.5" />
          </g>
        );
      })}

      {/* top antenna with magenta tip */}
      <line x1="100" y1="40" x2="100" y2="18" stroke={cyan} strokeOpacity="0.4" strokeWidth="1" />
      <circle cx="100" cy="16" r="2.5" fill={magenta} className="animate-pulse" style={{ filter: `drop-shadow(0 0 4px ${magenta})` }} />
    </svg>
  );
}
