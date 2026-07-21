import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Save, Download, Monitor, Upload, Trash2, Image as ImageIcon, Database, Wifi } from "lucide-react";
import { loadCacheSsh, saveCacheSsh, DEFAULT_CACHE_SSH, type CacheSshConfig } from "@/lib/cache-activity";
import {
  DEFAULT_SETTINGS,
  GRADIENT_PRESETS,
  SHAPE_OPTIONS,
  CLIENT_LAYOUT_OPTIONS,
  gradientCss,
  loadSettings,
  saveSettings,
  type Band,
  type ClientLayout,
  type ColorMode,
  type GaugeSettings,
  type GaugeShape,
  type GradientPreset,
  type GradientStop,
} from "@/lib/gauge-settings";
import {
  DEFAULT_VIEWER_PATH,
  defaultConfig,
  downloadVncBat,
  loadVncConfig,
  saveVncConfig,
  type VncConfig,
} from "@/lib/vnc-config";
import { loadPowerCreds, savePowerCreds } from "@/lib/power";
import { CircularGauge } from "@/components/monitoring/CircularGauge";
import { clearLogo, loadLogo, saveLogo, type StoredLogo } from "@/lib/branding";
import { loadMikrotikConfig, pushMikrotikConfigToAgent, saveMikrotikConfig, type MikrotikConfig } from "@/lib/mikrotik-config";
import { ThemeEditor } from "@/components/monitoring/ThemeEditor";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Exir Gamenet Monitoring" }] }),
  component: SettingsPage,
});

const PRESET_SWATCHES = [
  "#22d3ee", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#facc15", "#f97316", "#ef4444", "#10b981", "#84cc16",
  "#76b900", "#ed1c24", "#00c7fd", "#ffffff", "#94a3b8",
];

function SettingsPage() {
  const [s, setS] = useState<GaugeSettings>(() => loadSettings());
  const [saved, setSaved] = useState(false);

  function updateBand(metric: "gpu" | "cpu" | "ping", idx: number, patch: Partial<Band>) {
    setS((prev) => {
      const bands = prev[metric].map((b, i) => (i === idx ? { ...b, ...patch } : b));
      return { ...prev, [metric]: bands };
    });
    setSaved(false);
  }

  function persist() {
    saveSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function reset() {
    setS(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 -z-10" style={{ background: "linear-gradient(180deg, oklch(0.1 0.02 260), oklch(0.07 0.02 260))" }} />
      <div className="fixed inset-0 -z-10 grid-bg opacity-30" />

      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/60 px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} /> back
          </Link>
          <h1 className="font-mono text-2xl font-black uppercase tracking-[0.25em] text-glow-cyan">
            gauge settings
          </h1>
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/60 px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <RotateCcw size={14} /> reset
            </button>
            <button
              onClick={persist}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/25"
            >
              <Save size={14} /> {saved ? "saved!" : "save"}
            </button>
          </div>
        </header>

        <p className="mb-6 font-mono text-xs text-muted-foreground">
          Configure gauge shapes, stroke width, color modes, and temperature color bands for GPU and CPU gauges.
          Each band defines the maximum value (°C) below which the color applies.
          Pick from 16M colors with the native color picker.
        </p>

        <ShapeGradientEditor
          shape={s.shape}
          clientShape={s.clientShape}
          clientLayout={s.clientLayout}
          colorMode={s.colorMode}
          gradient={s.gradient}
          strokeWidth={s.strokeWidth}
          customGradients={s.customGradients}
          hiddenGradientIds={s.hiddenGradientIds}
          onShape={(shape) => { setS((p) => ({ ...p, shape })); setSaved(false); }}
          onClientShape={(clientShape) => { setS((p) => ({ ...p, clientShape })); setSaved(false); }}
          onClientLayout={(clientLayout) => { setS((p) => ({ ...p, clientLayout })); setSaved(false); }}
          onColorMode={(colorMode) => { setS((p) => ({ ...p, colorMode })); setSaved(false); }}
          onGradient={(gradient) => { setS((p) => ({ ...p, gradient })); setSaved(false); }}
          onStrokeWidth={(strokeWidth) => { setS((p) => ({ ...p, strokeWidth })); setSaved(false); }}
          onCustomGradients={(customGradients) => { setS((p) => ({ ...p, customGradients })); setSaved(false); }}
          onHiddenGradientIds={(hiddenGradientIds) => { setS((p) => ({ ...p, hiddenGradientIds })); setSaved(false); }}
        />

        <ThemeEditor />

        <LogoEditor />

        <div className="grid gap-6 md:grid-cols-2">
          <MetricEditor
            title="GPU Temperature"
            unit="°C"
            maxCap={120}
            bands={s.gpu}
            onChange={(i, patch) => updateBand("gpu", i, patch)}
          />
          <MetricEditor
            title="CPU Temperature"
            unit="°C"
            maxCap={120}
            bands={s.cpu}
            onChange={(i, patch) => updateBand("cpu", i, patch)}
          />
        </div>

        <div className="mt-6">
          <MetricEditor
            title="Ping (ms)"
            unit="ms"
            maxCap={2000}
            labels={["Good", "Slow", "Bad"]}
            bands={s.ping}
            onChange={(i, patch) => updateBand("ping", i, patch)}
          />
        </div>

        <div className="mt-8 rounded-xl p-5 glass-panel">
          <div className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            live preview
          </div>
          <div className="flex items-center justify-around">
            {[30, 55, 70, 82, 95].map((v) => (
              <div key={v} className="flex flex-col items-center gap-2">
                <CircularGauge
                  label={`${v}°`}
                  value={v}
                  size={70}
                  bands={s.gpu}
                  shape={s.shape}
                  colorMode={s.colorMode}
                  gradient={s.gradient}
                  strokeWidth={s.strokeWidth}
                />
                <span className="font-mono text-[10px] uppercase text-muted-foreground">GPU @ {v}°</span>
              </div>
            ))}
          </div>
        </div>

        <PowerCredsEditor />
        <MikrotikEditor />
        <CacheSshEditor />
        <VncEditor />
      </div>
    </div>
  );
}

function ShapeGradientEditor({
  shape,
  clientShape,
  clientLayout,
  colorMode,
  gradient,
  strokeWidth,
  customGradients,
  hiddenGradientIds,
  onShape,
  onClientShape,
  onClientLayout,
  onColorMode,
  onGradient,
  onStrokeWidth,
  onCustomGradients,
  onHiddenGradientIds,
}: {
  shape: GaugeShape;
  clientShape: GaugeShape;
  clientLayout: ClientLayout;
  colorMode: ColorMode;
  gradient: GradientPreset;
  strokeWidth: number;
  customGradients: GradientPreset[];
  hiddenGradientIds: string[];
  onShape: (s: GaugeShape) => void;
  onClientShape: (s: GaugeShape) => void;
  onClientLayout: (l: ClientLayout) => void;
  onColorMode: (m: ColorMode) => void;
  onGradient: (g: GradientPreset) => void;
  onStrokeWidth: (w: number) => void;
  onCustomGradients: (g: GradientPreset[]) => void;
  onHiddenGradientIds: (ids: string[]) => void;
}) {
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customStops, setCustomStops] = useState<GradientStop[]>([
    { at: 0, color: "#22d3ee" },
    { at: 0.5, color: "#facc15" },
    { at: 1, color: "#ef4444" },
  ]);

  const visibleBuiltIns = GRADIENT_PRESETS.filter((p) => !hiddenGradientIds.includes(p.id));
  const allPresets = [...visibleBuiltIns, ...customGradients];
  // Fallback preset to switch to if the currently-selected gradient gets removed.
  const fallbackPreset = visibleBuiltIns[0] ?? customGradients[0] ?? GRADIENT_PRESETS[0];

  function addCustomGradient() {
    if (!customName.trim()) return;
    const id = `custom-${Date.now()}`;
    const newPreset: GradientPreset = {
      id,
      name: customName.trim(),
      stops: [...customStops].sort((a, b) => a.at - b.at),
      custom: true,
    };
    onCustomGradients([...customGradients, newPreset]);
    onGradient(newPreset);
    setCustomName("");
    setShowCustomBuilder(false);
  }

  /** Removes a gradient from the picker. Custom ones are deleted for good;
   * built-in ones are just hidden (and can be brought back with "Restore"). */
  function removeGradient(preset: GradientPreset) {
    if (preset.custom) {
      onCustomGradients(customGradients.filter((g) => g.id !== preset.id));
    } else {
      onHiddenGradientIds([...hiddenGradientIds, preset.id]);
    }
    if (gradient.id === preset.id) onGradient(fallbackPreset);
  }

  function restoreHiddenGradients() {
    onHiddenGradientIds([]);
  }

  function updateStopColor(idx: number, color: string) {
    const next = [...customStops];
    next[idx] = { ...next[idx], color };
    setCustomStops(next);
  }

  function updateStopPosition(idx: number, at: number) {
    const next = [...customStops];
    next[idx] = { ...next[idx], at: Math.max(0, Math.min(1, at)) };
    setCustomStops(next);
  }

  function addStop() {
    if (customStops.length >= 8) return;
    const sorted = [...customStops].sort((a, b) => a.at - b.at);
    const lastAt = sorted[sorted.length - 1].at;
    const newAt = Math.min(1, lastAt + 0.1);
    setCustomStops([...customStops, { at: newAt, color: "#ffffff" }]);
  }

  function removeStop(idx: number) {
    if (customStops.length <= 2) return;
    setCustomStops(customStops.filter((_, i) => i !== idx));
  }

  return (
    <div className="mb-6 rounded-xl p-5 glass-panel">
      <h2 className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.2em] text-glow-cyan">
        Gauge Shape & Color Mode
      </h2>

      {/* Main gauge shape selector */}
      <div className="mb-5">
        <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Main gauge shape (server card)
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {SHAPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onShape(opt.value)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition ${
                shape === opt.value
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                  : "border-border/60 bg-surface/40 text-muted-foreground hover:border-cyan-500/40 hover:text-foreground"
              }`}
            >
              <ShapePreview shape={opt.value} active={shape === opt.value} strokeWidth={strokeWidth} />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Client station gauge shape selector */}
      <div className="mb-5">
        <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Client station gauge shape (client cards)
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {SHAPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onClientShape(opt.value)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition ${
                clientShape === opt.value
                  ? "border-magenta-500 bg-magenta-500/15 text-magenta-300"
                  : "border-border/60 bg-surface/40 text-muted-foreground hover:border-magenta-500/40 hover:text-foreground"
              }`}
            >
              <ShapePreview shape={opt.value} active={clientShape === opt.value} strokeWidth={strokeWidth} />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Client station layout selector */}
      <div className="mb-5">
        <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Client station layout (how 12 clients are displayed)
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {CLIENT_LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onClientLayout(opt.value)}
              className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition ${
                clientLayout === opt.value
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                  : "border-border/60 bg-surface/40 text-muted-foreground hover:border-cyan-500/40 hover:text-foreground"
              }`}
            >
              <LayoutPreview layout={opt.value} active={clientLayout === opt.value} />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">{opt.label}</span>
              <span className="font-mono text-[8px] text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stroke width slider */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Stroke width (ring thickness)
          </label>
          <span className="font-mono text-xs font-bold text-cyan-300">{strokeWidth}px</span>
        </div>
        <input
          type="range"
          min={1}
          max={12}
          step={0.5}
          value={strokeWidth}
          onChange={(e) => onStrokeWidth(parseFloat(e.target.value))}
          className="mt-2 w-full accent-cyan-500"
        />
        <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
          <span>Thin (1px)</span>
          <span>Thick (12px)</span>
        </div>
      </div>

      {/* Color mode toggle */}
      <div className="mb-5">
        <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Color mode
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => onColorMode("bands")}
            className={`flex-1 rounded-lg border px-3 py-2 font-mono text-xs uppercase tracking-wider transition ${
              colorMode === "bands"
                ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                : "border-border/60 bg-surface/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            Bands (discrete)
          </button>
          <button
            onClick={() => onColorMode("gradient")}
            className={`flex-1 rounded-lg border px-3 py-2 font-mono text-xs uppercase tracking-wider transition ${
              colorMode === "gradient"
                ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                : "border-border/60 bg-surface/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            Gradient (single color)
          </button>
          <button
            onClick={() => onColorMode("gradientFill")}
            className={`flex-1 rounded-lg border px-3 py-2 font-mono text-xs uppercase tracking-wider transition ${
              colorMode === "gradientFill"
                ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                : "border-border/60 bg-surface/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            Gradient Fill (spectrum)
          </button>
        </div>
      </div>

      {/* Gradient presets — show for both gradient and gradientFill modes */}
      {(colorMode === "gradient" || colorMode === "gradientFill") && (
        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Gradient preset
            </label>
            <div className="flex items-center gap-3">
              {hiddenGradientIds.length > 0 && (
                <button
                  onClick={restoreHiddenGradients}
                  title="Bring back the gradients you removed"
                  className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  Restore hidden ({hiddenGradientIds.length})
                </button>
              )}
              <button
                onClick={() => setShowCustomBuilder(!showCustomBuilder)}
                className="font-mono text-[10px] uppercase tracking-wider text-cyan-400 hover:text-cyan-300"
              >
                {showCustomBuilder ? "Close builder" : "+ Create custom gradient"}
              </button>
            </div>
          </div>

          {/* Preset grid — hover any swatch to reveal its remove (×) button.
              Built-in gradients get hidden (restorable); custom ones are deleted for good. */}
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {allPresets.map((p) => (
              <div
                key={p.id}
                className={`group relative rounded-lg border p-2 text-left transition ${
                  gradient.id === p.id
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-border/60 bg-surface/40 hover:border-cyan-500/40"
                }`}
              >
                <button onClick={() => onGradient(p)} className="w-full text-left">
                  <div
                    className="mb-1.5 h-6 w-full rounded"
                    style={{ background: gradientCss(p, 90) }}
                  />
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {p.name}
                  </span>
                </button>
                <button
                  onClick={() => removeGradient(p)}
                  disabled={allPresets.length <= 1}
                  title={p.custom ? "Delete this custom gradient" : "Remove from the list (can be restored later)"}
                  className="absolute right-1.5 top-1.5 rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[9px] text-red-400 opacity-0 transition hover:bg-red-500/40 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Custom gradient builder */}
          {showCustomBuilder && (
            <div className="mt-4 rounded-lg border border-cyan-500/30 bg-surface/60 p-4">
              <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-cyan-300">
                Custom Gradient Builder
              </h3>

              {/* Live preview */}
              <div
                className="mb-4 h-10 w-full rounded-lg border border-border/60"
                style={{ background: gradientCss({ id: "preview", name: "Preview", stops: customStops }, 90) }}
              />

              {/* Name input */}
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Gradient name (e.g. My Sunset)"
                className="mb-4 w-full rounded-lg border border-border/60 bg-surface/40 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground"
              />

              {/* Stops editor */}
              <div className="space-y-2">
                {customStops.map((stop, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={stop.color}
                      onChange={(e) => updateStopColor(idx, e.target.value)}
                      className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border/60 bg-transparent"
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={stop.at}
                      onChange={(e) => updateStopPosition(idx, parseFloat(e.target.value))}
                      className="flex-1 accent-cyan-500"
                    />
                    <span className="w-10 font-mono text-[10px] text-muted-foreground">
                      {(stop.at * 100).toFixed(0)}%
                    </span>
                    <button
                      onClick={() => removeStop(idx)}
                      disabled={customStops.length <= 2}
                      className="rounded bg-red-500/20 px-2 py-1 font-mono text-[9px] text-red-400 hover:bg-red-500/40 disabled:opacity-30"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={addStop}
                  disabled={customStops.length >= 8}
                  className="rounded-lg border border-border/60 bg-surface/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400 hover:border-cyan-500/40 disabled:opacity-30"
                >
                  + Add color stop
                </button>
                <button
                  onClick={addCustomGradient}
                  disabled={!customName.trim()}
                  className="rounded-lg border border-cyan-500 bg-cyan-500/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-30"
                >
                  Save gradient
                </button>
              </div>
            </div>
          )}

          <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {colorMode === "gradientFill"
              ? "In Gradient Fill mode, the gauge shows the full color spectrum up to the current value. For example, if your gradient is green → yellow → red and the temperature is 50%, the gauge fills green-to-yellow. At 80%, it extends through yellow toward red. The entire spectrum is always visible up to the fill point."
              : "In Gradient mode, the entire gauge uses a single interpolated color based on the value. Lower values use the leftmost color; higher values shift toward the right."}
          </p>
        </div>
      )}

      {colorMode === "bands" && (
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          In bands mode, each metric uses discrete color thresholds defined below. You can set
          separate bands for GPU, CPU, and ping.
        </p>
      )}
    </div>
  );
}

/** Mini SVG preview of a shape for the selector buttons. */
function ShapePreview({ shape, active, strokeWidth = 3 }: { shape: GaugeShape; active: boolean; strokeWidth?: number }) {
  const s = 28;
  const cx = s / 2;
  const cy = s / 2;
  const r = 10;
  const color = active ? "#22d3ee" : "oklch(0.6 0.04 260)";
  const bg = "oklch(0.3 0.04 260 / 0.5)";
  const sw = Math.max(1.5, Math.min(strokeWidth, 4));

  if (shape === "line") {
    return (
      <svg width={s} height={s}>
        <rect x={3} y={cy - 3} width={s - 6} height={6} rx={3} fill={bg} />
        <rect x={3} y={cy - 3} width={(s - 6) * 0.65} height={6} rx={3} fill={color} />
      </svg>
    );
  }
  if (shape === "semicircle") {
    return (
      <svg width={s} height={s}>
        <path d={`M ${cx - r} ${cy + 2} A ${r} ${r} 0 0 1 ${cx + r} ${cy + 2}`} stroke={bg} strokeWidth={sw} fill="none" strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy + 2} A ${r} ${r} 0 0 1 ${cx + r} ${cy + 2}`} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={`${Math.PI * r * 0.65}`} />
      </svg>
    );
  }

  let sides = 0;
  let rot = 0;
  switch (shape) {
    case "octagon": sides = 8; rot = Math.PI / 8; break;
    case "hexagon": sides = 6; break;
    case "triangle": sides = 3; break;
    case "square": sides = 4; rot = Math.PI / 4; break;
    default: sides = 0; // circle
  }

  if (sides === 0) {
    return (
      <svg width={s} height={s}>
        <circle cx={cx} cy={cy} r={r} stroke={bg} strokeWidth={sw} fill="none" />
        <circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * r * 0.65}`} />
      </svg>
    );
  }

  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  const polyPts = pts.join(" ");
  const perim = 2 * r * Math.sin(Math.PI / sides) * sides;
  return (
    <svg width={s} height={s}>
      <polygon points={polyPts} stroke={bg} strokeWidth={sw} fill="none" strokeLinejoin="round" />
      <polygon points={polyPts} stroke={color} strokeWidth={sw} fill="none" strokeLinejoin="round" strokeDasharray={`${perim * 0.65}`} />
    </svg>
  );
}

/** Mini SVG preview of a client layout for the selector buttons. */
function LayoutPreview({ layout, active }: { layout: ClientLayout; active: boolean }) {
  const color = active ? "#22d3ee" : "oklch(0.6 0.04 260)";
  const bg = "oklch(0.3 0.04 260 / 0.4)";
  const s = 36;

  if (layout === "grid") {
    return (
      <svg width={s} height={s}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          return <rect key={i} x={2 + col * 11} y={2 + row * 11} width={9} height={9} rx={1.5} fill={bg} stroke={color} strokeWidth={0.8} />;
        })}
      </svg>
    );
  }
  if (layout === "hex") {
    const hex = (cx: number, cy: number, r: number) => {
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
      }
      return pts.join(" ");
    };
    return (
      <svg width={s} height={s}>
        <polygon points={hex(10, 9, 5)} fill={bg} stroke={color} strokeWidth={0.8} />
        <polygon points={hex(22, 9, 5)} fill={bg} stroke={color} strokeWidth={0.8} />
        <polygon points={hex(16, 18, 5)} fill={bg} stroke={color} strokeWidth={0.8} />
        <polygon points={hex(28, 18, 5)} fill={bg} stroke={color} strokeWidth={0.8} />
      </svg>
    );
  }
  // list
  return (
    <svg width={s} height={s}>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={3} y={3 + i * 8} width={s - 6} height={6} rx={1.5} fill={bg} stroke={color} strokeWidth={0.8} />
      ))}
    </svg>
  );
}

function MetricEditor({
  title,
  bands,
  onChange,
  unit = "°C",
  maxCap = 120,
  labels = ["Cool", "Warm", "Critical"],
}: {
  title: string;
  bands: Band[];
  onChange: (idx: number, patch: Partial<Band>) => void;
  unit?: string;
  maxCap?: number;
  labels?: string[];
}) {
  return (
    <div className="rounded-xl p-5 glass-panel">
      <h2 className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.2em] text-glow-cyan">{title}</h2>
      <div className="space-y-4">
        {bands.map((b, i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-surface/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: b.color }}>
                ▸ {labels[i] ?? `Band ${i + 1}`}
              </span>
              <span className="rounded px-2 py-0.5 font-mono text-[10px]" style={{ background: `${b.color}22`, color: b.color, border: `1px solid ${b.color}66` }}>
                ≤ {b.max}
                {unit}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <label className="font-mono text-[10px] uppercase text-muted-foreground">max ({unit})</label>
                <input
                  type="number"
                  min={0}
                  max={maxCap}
                  value={b.max}
                  onChange={(e) => onChange(i, { max: Number(e.target.value) })}
                  className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-sm outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase text-muted-foreground">color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={b.color}
                    onChange={(e) => onChange(i, { color: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <input
                    type="text"
                    value={b.color}
                    onChange={(e) => onChange(i, { color: e.target.value })}
                    className="w-24 rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {PRESET_SWATCHES.map((sw) => (
                <button
                  key={sw}
                  onClick={() => onChange(i, { color: sw })}
                  className="size-5 rounded border border-border/60 transition hover:scale-110"
                  style={{ background: sw, boxShadow: b.color.toLowerCase() === sw ? `0 0 0 2px ${sw}` : "none" }}
                  title={sw}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogoEditor() {
  const [meta, setMeta] = useState<StoredLogo | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    loadLogo().then((l) => {
      if (!alive) return;
      setMeta(l);
      if (l) setUrl(URL.createObjectURL(l.blob));
    });
    return () => {
      alive = false;
    };
  }, []);

  async function onPick(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      alert("File larger than 20MB");
      return;
    }
    await saveLogo(file);
    const l = await loadLogo();
    setMeta(l);
    if (url) URL.revokeObjectURL(url);
    setUrl(l ? URL.createObjectURL(l.blob) : null);
  }

  async function onClear() {
    await clearLogo();
    setMeta(null);
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
  }

  return (
    <div className="mb-6 rounded-xl p-5 glass-panel">
      <h2 className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.2em] text-glow-cyan">
        <ImageIcon className="mr-2 inline size-4" /> Brand Logo (shown top-left, fallback: “E”)
      </h2>
      <div className="flex items-center gap-4">
        <div className="flex size-20 items-center justify-center rounded-lg border border-border bg-surface/70 overflow-hidden">
          {url ? (
            <img src={url} alt="logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="font-mono text-4xl font-black text-glow-cyan">E</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPick(f);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md border border-cyan-500/60 bg-cyan-500/10 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-500/20"
            >
              <Upload className="size-3.5" /> Upload logo (up to 20MB, any format)
            </button>
            {meta && (
              <button
                onClick={onClear}
                className="inline-flex items-center gap-2 rounded-md border border-rose-500/60 bg-rose-500/10 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-rose-300 transition hover:bg-rose-500/20"
              >
                <Trash2 className="size-3.5" /> Remove
              </button>
            )}
          </div>
          {meta && (
            <div className="font-mono text-[11px] text-muted-foreground">
              {meta.name} — {(meta.size / 1024).toFixed(1)} KB — {meta.type || "unknown"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function VncEditor() {
  const [cfg, setCfg] = useState<VncConfig>(() => loadVncConfig());
  const [saved, setSaved] = useState(false);

  function persist(next: VncConfig) {
    setCfg(next);
    saveVncConfig(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function updateMachine(i: number, patch: Partial<{ host: string; port: number; mac: string }>) {
    persist({
      ...cfg,
      machines: cfg.machines.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    });
  }

  return (
    <div className="mt-8 rounded-xl p-5 glass-panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-glow-magenta">
          ▸ VNC Launcher
        </h2>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">
          {saved ? "saved ✓" : "click Connect → downloads VNC-XX.bat → run it"}
        </span>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[2fr_1fr]">
        <div>
          <label className="font-mono text-[10px] uppercase text-muted-foreground">
            UltraVNC viewer path
          </label>
          <input
            type="text"
            value={cfg.viewerPath}
            onChange={(e) => persist({ ...cfg, viewerPath: e.target.value })}
            placeholder={DEFAULT_VIEWER_PATH}
            className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase text-muted-foreground">
            Password (optional)
          </label>
          <input
            type="text"
            value={cfg.password}
            onChange={(e) => persist({ ...cfg, password: e.target.value })}
            placeholder="empty = prompt in viewer"
            className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          machine → host:port
        </span>
        <button
          onClick={() => persist(defaultConfig())}
          className="flex items-center gap-1 rounded border border-border/60 px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
        >
          <RotateCcw size={11} /> reset defaults
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {cfg.machines.map((m, i) => (
          <div key={m.machine} className="rounded-lg border border-border/60 bg-surface/40 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-glow-cyan">{m.machine}</span>
              <button
                onClick={() => downloadVncBat(cfg, m.machine)}
                title="test — download & run the .bat"
                className="flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] uppercase text-cyan-300 hover:bg-cyan-500/20"
              >
                <Download size={10} /> test
              </button>
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={m.host}
                onChange={(e) => updateMachine(i, { host: e.target.value })}
                placeholder="ip / host"
                className="min-w-0 flex-1 rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] outline-none focus:border-cyan-500"
              />
              <input
                type="number"
                min={1}
                max={65535}
                value={m.port}
                onChange={(e) => updateMachine(i, { port: Number(e.target.value) })}
                className="w-16 rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] outline-none focus:border-cyan-500"
              />
            </div>
            <input
              type="text"
              value={m.mac || ""}
              onChange={(e) => updateMachine(i, { mac: e.target.value })}
              placeholder="MAC (AA:BB:CC:DD:EE:FF) — for Wake-on-LAN"
              className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1 font-mono text-[10px] outline-none focus:border-emerald-500"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 font-mono text-[11px] leading-relaxed text-emerald-100/90">
        <div className="mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wider">
          <Monitor size={12} /> one-click launch (via local agent)
        </div>
        Click "Connect VNC" or any of the 12 icons up top → the local agent
        (<span className="font-bold">ping-agent.mjs</span>, auto-started with
        <span className="font-bold"> npm run dev</span>) spawns UltraVNC directly against the
        IP:PORT you set here. No download, no double-click.
        <div className="mt-1 opacity-80">
          If the agent isn't running, the app falls back to downloading a <span className="font-bold">VNC-VIPxx.bat</span> file
          you can run manually. To start the agent by itself: <span className="font-bold">npm run agent</span>.
        </div>
      </div>
    </div>
  );
}

function MikrotikEditor() {
  const [cfg, setCfg] = useState<MikrotikConfig>(() => loadMikrotikConfig());
  const [status, setStatus] = useState("");

  function update(patch: Partial<MikrotikConfig>) {
    setCfg((prev) => ({ ...prev, ...patch }));
    setStatus("");
  }

  async function save() {
    saveMikrotikConfig(cfg);
    const pushed = await pushMikrotikConfigToAgent(cfg);
    setStatus(pushed.ok ? "saved ✓" : `saved locally · ${pushed.error || "agent offline"}`);
    setTimeout(() => setStatus(""), 2500);
  }

  return (
    <div className="mt-8 rounded-xl p-5 glass-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.2em] text-glow-cyan">
          <Wifi size={14} /> ▸ MikroTik Hotspot
        </h2>
        <button
          onClick={save}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/25"
        >
          <Save size={14} /> {status || "save"}
        </button>
      </div>
      <p className="mb-3 font-mono text-[11px] text-muted-foreground">
        Used by the Hotspot pill for active users, IP, MAC, uptime and traffic.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="router host / ip">
          <input value={cfg.host} onChange={(e) => update({ host: e.target.value })} placeholder="192.168.3.200"
            className="w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500" />
        </Field>
        <Field label="hotspot network (CIDR) — e.g. 192.168.3.0/24">
          <input value={cfg.subnet} onChange={(e) => update({ subnet: e.target.value })} placeholder="192.168.3.0/24"
            className="w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500" />
          <p className="mt-1 font-fa text-[10px] text-muted-foreground/80" lang="fa">
            محدوده‌ی آی‌پی که هات‌اسپات میکروتیک به کاربران می‌ده — همون subnet شبکه‌ی VIPها (نه IP روتر).
          </p>
        </Field>
        <Field label="user">
          <input value={cfg.user} onChange={(e) => update({ user: e.target.value })}
            className="w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500" />
        </Field>
        <Field label="password">
          <input type="password" value={cfg.pass} onChange={(e) => update({ pass: e.target.value })}
            className="w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500" />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        <input type="checkbox" checked={cfg.useHttps} onChange={(e) => update({ useHttps: e.target.checked })} />
        use HTTPS REST API
      </label>
    </div>
  );
}


function PowerCredsEditor() {
  const [creds, setCreds] = useState(() => loadPowerCreds());
  function update(patch: Partial<{ user: string; pass: string }>) {
    const next = { ...creds, ...patch };
    setCreds(next);
    savePowerCreds(next);
  }
  return (
    <div className="mt-8 rounded-xl p-5 glass-panel">
      <h2 className="mb-3 font-mono text-sm font-bold uppercase tracking-[0.2em] text-glow-magenta">
        ▸ Remote Power Credentials (Windows shutdown /m)
      </h2>
      <p className="mb-3 font-mono text-[11px] text-muted-foreground">
        Used by Shutdown / Restart / Logoff. WoL only needs MAC (set per machine above).
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="font-mono text-[10px] uppercase text-muted-foreground">admin user (e.g. DOMAIN\Admin)</label>
          <input value={creds.user || ""} onChange={(e) => update({ user: e.target.value })}
            className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500" />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase text-muted-foreground">password</label>
          <input type="password" value={creds.pass || ""} onChange={(e) => update({ pass: e.target.value })}
            className="mt-1 w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500" />
        </div>
      </div>
    </div>
  );
}

function CacheSshEditor() {
  const [cfg, setCfg] = useState<CacheSshConfig>(() => loadCacheSsh());
  function update(patch: Partial<CacheSshConfig>) {
    const next = { ...cfg, ...patch };
    setCfg(next);
    saveCacheSsh(next);
  }
  return (
    <div className="mt-8 rounded-xl p-5 glass-panel">
      <h2 className="mb-3 flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.2em] text-glow-cyan">
        <Database size={14} /> ▸ LanCache SSH (access.log tail)
      </h2>
      <p className="mb-3 font-mono text-[11px] text-muted-foreground">
        The local agent SSHes into your LanCache host and tails
        <span className="font-bold"> {DEFAULT_CACHE_SSH.logPath}</span>. Per-client
        HIT/MISS status appears on every VIP card and in the Cache Activity panel.
      </p>
      <div className="mb-3 flex items-center gap-2">
        <input
          id="cache-enabled"
          type="checkbox"
          checked={cfg.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
        />
        <label htmlFor="cache-enabled" className="font-mono text-xs uppercase tracking-wider">
          enable cache polling
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="host / ip">
          <input value={cfg.host} onChange={(e) => update({ host: e.target.value })}
            className="w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500" />
        </Field>
        <Field label="ssh port">
          <input type="number" min={1} max={65535} value={cfg.port}
            onChange={(e) => update({ port: Number(e.target.value) || 22 })}
            className="w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500" />
        </Field>
        <Field label="user">
          <input value={cfg.user} onChange={(e) => update({ user: e.target.value })}
            className="w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500" />
        </Field>
        <Field label="password">
          <input type="password" value={cfg.pass} onChange={(e) => update({ pass: e.target.value })}
            className="w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500" />
        </Field>
        <div className="md:col-span-2">
          <Field label="log path">
            <input value={cfg.logPath} onChange={(e) => update({ logPath: e.target.value })}
              className="w-full rounded border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-500" />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
