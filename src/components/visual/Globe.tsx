import { useEffect, useRef } from "react";
import createGlobe, { type COBEOptions } from "cobe";

/**
 * WebGL globe rendered with cobe. Lazy-mounted only when in view to keep
 * the hero section from paying the cost off-screen.
 */
export function Globe({
  size = 320,
  className,
  options,
}: {
  size?: number;
  className?: string;
  options?: Partial<COBEOptions>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let destroyed = false;

    const base = {
      width: size * 2,
      height: size * 2,
      devicePixelRatio: 2,
      phi: 0,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.07, 0.08, 0.14],
      markerColor: [0.85, 0.83, 0.93],
      glowColor: [0.13, 0.82, 0.93],
      markers: [],
      onRender: (state: { phi: number }) => {
        state.phi = phiRef.current;
        phiRef.current += 0.005;
      },
      ...options,
    } as unknown as COBEOptions;

    const globe = createGlobe(canvasRef.current, base);

    return () => {
      destroyed = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      globe.destroy();
    };
  }, [size, options]);

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{ width: size, height: size }}
      className={className}
    />
  );
}
