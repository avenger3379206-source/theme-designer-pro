import { useMemo } from "react";

/**
 * Lightweight dotted world map drawn from a coarse landmass mask.
 * No external topojson dependency — uses a compact bounding-box approximation
 * with dot grid sampling. Good enough for the CDN discovery panel aesthetic.
 */
export function DottedWorldMap({ className }: { className?: string }) {
  const dots = useMemo(() => {
    // crude landmass regions as [x1,y1,x2,y2] in 0..100 coordinate space
    const regions: [number, number, number, number][] = [
      // North America
      [8, 18, 30, 40],
      // South America
      [22, 42, 32, 72],
      // Europe
      [44, 20, 56, 34],
      // Africa
      [46, 36, 60, 66],
      // Middle East
      [56, 30, 64, 40],
      // Asia
      [58, 18, 86, 42],
      // Southeast Asia
      [74, 40, 84, 52],
      // Australia
      [80, 56, 92, 68],
    ];
    const points: { x: number; y: number }[] = [];
    const step = 1.6;
    for (let x = 0; x <= 100; x += step) {
      for (let y = 0; y <= 70; y += step) {
        const inside = regions.some(
          ([x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2,
        );
        if (inside) points.push({ x, y });
      }
    }
    return points;
  }, []);

  return (
    <svg viewBox="0 0 100 70" className={className} preserveAspectRatio="xMidYMid meet">
      {dots.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="0.32"
          fill="var(--neon-cyan)"
          opacity="0.55"
        />
      ))}
    </svg>
  );
}
