// Per-metric color bands for circular gauges + ping panel. Persisted in localStorage.
// Each band: value <= max uses `color`. Bands must be sorted ascending by max.

export interface Band {
  max: number;
  color: string; // hex (#rrggbb) so <input type="color"> works
}

export type GaugeShape =
  | "circle"
  | "line"
  | "semicircle"
  | "octagon"
  | "hexagon"
  | "triangle"
  | "square";

export type ColorMode = "bands" | "gradient" | "gradientFill";

export type ClientLayout = "grid" | "hex" | "list";

export interface GradientStop {
  at: number; // 0..1
  color: string; // hex
}

export interface GradientPreset {
  id: string;
  name: string;
  stops: GradientStop[];
  custom?: boolean; // true if user-created
}

export interface GaugeSettings {
  gpu: Band[];
  cpu: Band[];
  ping: Band[];
  shape: GaugeShape;
  colorMode: ColorMode;
  gradient: GradientPreset;
  strokeWidth: number; // 1..12, thickness of gauge ring/outline
  clientShape: GaugeShape; // shape for client station cards
  clientLayout: ClientLayout; // layout for client stations grid
  customGradients: GradientPreset[]; // user-created gradient presets
  hiddenGradientIds: string[]; // built-in GRADIENT_PRESETS ids the user removed from the picker
}

const STORAGE_KEY = "exir.gauge.settings.v3";

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: "rainbow",
    name: "Rainbow",
    stops: [
      { at: 0, color: "#22d3ee" },
      { at: 0.25, color: "#22c55e" },
      { at: 0.5, color: "#facc15" },
      { at: 0.75, color: "#f97316" },
      { at: 1, color: "#ef4444" },
    ],
  },
  {
    id: "orange-yellow",
    name: "Orange → Yellow",
    stops: [
      { at: 0, color: "#f97316" },
      { at: 0.5, color: "#fb923c" },
      { at: 1, color: "#facc15" },
    ],
  },
  {
    id: "indigo-blue",
    name: "Indigo → Blue",
    stops: [
      { at: 0, color: "#4f46e5" },
      { at: 0.5, color: "#3b82f6" },
      { at: 1, color: "#0ea5e9" },
    ],
  },
  {
    id: "cyan-green",
    name: "Cyan → Green",
    stops: [
      { at: 0, color: "#22d3ee" },
      { at: 0.5, color: "#14b8a6" },
      { at: 1, color: "#22c55e" },
    ],
  },
  {
    id: "red-magenta",
    name: "Red → Magenta",
    stops: [
      { at: 0, color: "#ef4444" },
      { at: 0.5, color: "#ec4899" },
      { at: 1, color: "#d946ef" },
    ],
  },
  {
    id: "green-yellow-red",
    name: "Green → Yellow → Red",
    stops: [
      { at: 0, color: "#22c55e" },
      { at: 0.5, color: "#facc15" },
      { at: 1, color: "#ef4444" },
    ],
  },
  {
    id: "blue-purple",
    name: "Blue → Purple",
    stops: [
      { at: 0, color: "#3b82f6" },
      { at: 0.5, color: "#8b5cf6" },
      { at: 1, color: "#a855f7" },
    ],
  },
  {
    id: "teal-cyan",
    name: "Teal → Cyan",
    stops: [
      { at: 0, color: "#0d9488" },
      { at: 0.5, color: "#06b6d4" },
      { at: 1, color: "#22d3ee" },
    ],
  },
];

export const CLIENT_LAYOUT_OPTIONS: { value: ClientLayout; label: string; desc: string }[] = [
  { value: "grid", label: "Grid", desc: "Classic rectangular grid" },
  { value: "hex", label: "Hexagon", desc: "Honeycomb hexagonal layout" },
  { value: "list", label: "List", desc: "Vertical stacked list" },
];

export const SHAPE_OPTIONS: { value: GaugeShape; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "line", label: "Line" },
  { value: "semicircle", label: "Semicircle" },
  { value: "octagon", label: "Octagon" },
  { value: "hexagon", label: "Hexagon" },
  { value: "triangle", label: "Triangle" },
  { value: "square", label: "Square" },
];

export const DEFAULT_SETTINGS: GaugeSettings = {
  gpu: [
    { max: 60, color: "#22d3ee" },
    { max: 75, color: "#facc15" },
    { max: 100, color: "#ef4444" },
  ],
  cpu: [
    { max: 60, color: "#22d3ee" },
    { max: 75, color: "#facc15" },
    { max: 100, color: "#ef4444" },
  ],
  ping: [
    { max: 30, color: "#22c55e" },
    { max: 80, color: "#facc15" },
    { max: 300, color: "#ef4444" },
  ],
  shape: "circle",
  colorMode: "bands",
  gradient: GRADIENT_PRESETS[0],
  strokeWidth: 4,
  clientShape: "circle",
  clientLayout: "grid",
  customGradients: [],
  hiddenGradientIds: [],
};

export function loadSettings(): GaugeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<GaugeSettings>;
      return {
        gpu: Array.isArray(p.gpu) && p.gpu.length === 3 ? p.gpu : DEFAULT_SETTINGS.gpu,
        cpu: Array.isArray(p.cpu) && p.cpu.length === 3 ? p.cpu : DEFAULT_SETTINGS.cpu,
        ping: Array.isArray(p.ping) && p.ping.length === 3 ? p.ping : DEFAULT_SETTINGS.ping,
        shape: p.shape ?? DEFAULT_SETTINGS.shape,
        colorMode: p.colorMode ?? DEFAULT_SETTINGS.colorMode,
        gradient: p.gradient ?? DEFAULT_SETTINGS.gradient,
        strokeWidth: typeof p.strokeWidth === "number" ? p.strokeWidth : DEFAULT_SETTINGS.strokeWidth,
        clientShape: p.clientShape ?? DEFAULT_SETTINGS.clientShape,
        clientLayout: p.clientLayout ?? DEFAULT_SETTINGS.clientLayout,
        customGradients: Array.isArray(p.customGradients) ? p.customGradients : [],
        hiddenGradientIds: Array.isArray(p.hiddenGradientIds) ? p.hiddenGradientIds : [],
      };
    }
    // migrate v2 (no shape/gradient/strokeWidth)
    const v2Raw = localStorage.getItem("exir.gauge.settings.v2");
    if (v2Raw) {
      const p = JSON.parse(v2Raw) as Partial<GaugeSettings>;
      return {
        gpu: Array.isArray(p.gpu) && p.gpu.length === 3 ? p.gpu : DEFAULT_SETTINGS.gpu,
        cpu: Array.isArray(p.cpu) && p.cpu.length === 3 ? p.cpu : DEFAULT_SETTINGS.cpu,
        ping: Array.isArray(p.ping) && p.ping.length === 3 ? p.ping : DEFAULT_SETTINGS.ping,
        shape: DEFAULT_SETTINGS.shape,
        colorMode: DEFAULT_SETTINGS.colorMode,
        gradient: DEFAULT_SETTINGS.gradient,
        strokeWidth: DEFAULT_SETTINGS.strokeWidth,
        clientShape: DEFAULT_SETTINGS.clientShape,
        clientLayout: DEFAULT_SETTINGS.clientLayout,
        customGradients: [],
        hiddenGradientIds: [],
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: GaugeSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("exir:gauge-settings"));
  } catch {
    /* ignore */
  }
}

export function colorFor(bands: Band[], value: number): string {
  const sorted = [...bands].sort((a, b) => a.max - b.max);
  for (const b of sorted) if (value <= b.max) return b.color;
  return sorted[sorted.length - 1]?.color ?? "#22d3ee";
}

/** Interpolate a gradient at a given fraction (0..1). */
export function gradientColorAt(preset: GradientPreset, frac: number): string {
  const stops = [...preset.stops].sort((a, b) => a.at - b.at);
  if (stops.length === 0) return "#22d3ee";
  const f = Math.max(0, Math.min(1, frac));
  if (f <= stops[0].at) return stops[0].color;
  if (f >= stops[stops.length - 1].at) return stops[stops.length - 1].color;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (f >= a.at && f <= b.at) {
      const t = (f - a.at) / (b.at - a.at || 1);
      return lerpColor(a.color, b.color, t);
    }
  }
  return stops[stops.length - 1].color;
}

/** Build a CSS linear-gradient string from a preset, for preview swatches. */
export function gradientCss(preset: GradientPreset, angle = 90): string {
  const stops = [...preset.stops].sort((a, b) => a.at - b.at);
  const parts = stops.map((s) => `${s.color} ${(s.at * 100).toFixed(1)}%`);
  return `linear-gradient(${angle}deg, ${parts.join(", ")})`;
}

/** Resolve the active color for a metric value given the current settings. */
export function resolveColor(
  settings: GaugeSettings,
  metric: "gpu" | "cpu" | "ping",
  value: number,
  max: number,
): string {
  if (settings.colorMode === "gradient" || settings.colorMode === "gradientFill") {
    return gradientColorAt(settings.gradient, value / max);
  }
  return colorFor(settings[metric], value);
}

/** Build a CSS linear-gradient string that fills from 0% to the current value
 * fraction, showing the full gradient spectrum up to that point. Used for
 * the "gradientFill" mode on bar-shaped gauges. */
export function gradientFillCss(
  preset: GradientPreset,
  frac: number,
  angle = 90,
): string {
  const stops = [...preset.stops].sort((a, b) => a.at - b.at);
  const f = Math.max(0, Math.min(1, frac));
  const parts = stops.map((s) => {
    const pct = Math.min(100, (s.at / f) * 100);
    return `${s.color} ${pct.toFixed(1)}%`;
  });
  return `linear-gradient(${angle}deg, ${parts.join(", ")})`;
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  if (!pa || !pb) return a;
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return rgbToHex(r, g, bl);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => v.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
