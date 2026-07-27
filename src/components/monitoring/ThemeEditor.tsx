import { useEffect, useState } from "react";
import {
  Palette,
  Check,
  LayoutGrid,
  MousePointer2,
  RotateCcw,
  Eye,
  Monitor,
  Wifi,
  Cpu,
  Activity,
  Type,
} from "lucide-react";
import {
  THEMES,
  loadTheme,
  saveTheme,
  type ThemeId,
  LAYOUTS,
  loadLayout,
  saveLayout,
  type LayoutId,
} from "@/lib/theme";
import {
  DEFAULT_SCROLLBAR_SETTINGS,
  loadScrollbarSettings,
  saveScrollbarSettings,
  type ScrollbarSettings,
} from "@/lib/scrollbar-settings";
import {
  DEFAULT_UI_SCALE,
  UI_SCALE_LIMITS,
  loadUiScale,
  saveUiScale,
  type UiScaleSettings,
} from "@/lib/ui-scale";

export function ThemeEditor() {
  const [current, setCurrent] = useState<ThemeId>(() => loadTheme());
  const [layout, setLayout] = useState<LayoutId>(() => loadLayout());
  const [scroll, setScroll] = useState<ScrollbarSettings>(() => loadScrollbarSettings());
  const [scale, setScale] = useState<UiScaleSettings>(() => loadUiScale());

  useEffect(() => {
    const h = () => setCurrent(loadTheme());
    const l = () => setLayout(loadLayout());
    window.addEventListener("exir:theme", h);
    window.addEventListener("exir:layout", l);
    return () => {
      window.removeEventListener("exir:theme", h);
      window.removeEventListener("exir:layout", l);
    };
  }, []);

  function updateScroll(patch: Partial<ScrollbarSettings>) {
    const next = { ...scroll, ...patch };
    setScroll(next);
    saveScrollbarSettings(next);
  }

  function updateScale(patch: Partial<UiScaleSettings>) {
    const next = { ...scale, ...patch };
    setScale(next);
    saveUiScale(next);
  }

  return (
    <section className="mb-6 rounded-xl glass-panel p-5 neon-border-cyan">
      {/* ── Live Preview ────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <Eye size={16} className="text-cyan-300" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-[0.25em] text-glow-cyan">
            Live Preview · پیش‌نمایش زنده
          </h2>
        </div>
        <div className="glass-panel overflow-hidden rounded-xl p-4" style={{ zoom: scale.base }}>
          {/* Fake top bar */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-md bg-[var(--neon-cyan)]/20 ring-1 ring-[var(--neon-cyan)]/40" />
              <div className="h-2.5 w-20 rounded-full bg-foreground/20" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]" />
              <span className="font-mono text-[10px] text-muted-foreground">ONLINE</span>
            </div>
          </div>
          {/* Fake stat row */}
          <div className="mb-3 grid grid-cols-3 gap-2">
            {[
              { icon: Monitor, label: "Clients", value: "12", color: "var(--neon-cyan)" },
              { icon: Wifi, label: "WAN", value: "86%", color: "var(--neon-green)" },
              { icon: Cpu, label: "CPU", value: "34%", color: "var(--neon-amber)" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border/40 bg-surface/60 p-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <s.icon className="size-3.5" style={{ color: s.color }} />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </span>
                </div>
                <div className="font-mono text-sm font-bold text-foreground">{s.value}</div>
              </div>
            ))}
          </div>
          {/* Fake client cards grid */}
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} data-card="client" className="glass-panel rounded-xl p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="size-5 rounded-md bg-foreground/10" />
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: i === 1 ? "var(--neon-red)" : "var(--neon-green)",
                      boxShadow: `0 0 6px ${i === 1 ? "var(--neon-red)" : "var(--neon-green)"}`,
                    }}
                  />
                </div>
                <div className="mb-1 h-1.5 w-3/4 rounded-full bg-foreground/15" />
                <div className="mb-2 h-1.5 w-1/2 rounded-full bg-foreground/10" />
                <div className="flex items-center gap-1">
                  <Activity className="size-2.5 text-[var(--neon-cyan)]" />
                  <div className="h-1 flex-1 rounded-full bg-foreground/10">
                    <div
                      className="h-1 rounded-full"
                      style={{ width: `${[65, 90, 40, 72][i]}%`, background: "var(--neon-cyan)" }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center font-mono text-[10px] text-muted-foreground">
            این پیش‌نمایش، تم و چیدمان فعلی شما را نشان می‌دهد
          </p>
        </div>
      </div>

      {/* ── Colors ─────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2">
        <Palette size={16} className="text-cyan-300" />
        <h2 className="font-mono text-sm font-bold uppercase tracking-[0.25em] text-glow-cyan">
          Colors · رنگ‌بندی
        </h2>
      </div>
      <p className="mb-4 font-mono text-[11px] text-muted-foreground">
        ۶ پالت دارک گیمری. با کلیک روی هر پالت، رنگ‌های کل داشبورد بلافاصله عوض می‌شه.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {THEMES.map((t) => {
          const active = t.id === current;
          return (
            <button
              key={t.id}
              onClick={() => {
                saveTheme(t.id);
                setCurrent(t.id);
              }}
              className={
                "group relative overflow-hidden rounded-lg border p-3 text-left transition " +
                (active
                  ? "border-cyan-400/70 bg-cyan-500/10 shadow-[0_0_20px_-6px_var(--neon-cyan)]"
                  : "border-border/60 bg-surface/40 hover:border-cyan-500/50 hover:bg-cyan-500/[0.05]")
              }
            >
              <div
                className="mb-3 h-16 w-full rounded-md"
                style={{
                  background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]} 45%, ${t.swatch[2]} 80%, ${t.swatch[3]})`,
                  boxShadow: `inset 0 0 20px ${t.swatch[2]}55`,
                }}
              />
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
                    {t.name}
                  </div>
                  <div className="font-fa text-[11px] text-muted-foreground" lang="fa">
                    {t.fa}
                  </div>
                </div>
                {active && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <div className="mt-2 font-mono text-[10px] leading-snug text-muted-foreground/80">
                {t.desc}
              </div>
              <div className="mt-2 flex gap-1">
                {t.swatch.map((c) => (
                  <span key={c} className="h-2 flex-1 rounded-sm" style={{ background: c }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Layouts ────────────────────────────────────────────────── */}
      <div className="mt-8 mb-4 flex items-center gap-2">
        <LayoutGrid size={16} className="text-cyan-300" />
        <h2 className="font-mono text-sm font-bold uppercase tracking-[0.25em] text-glow-cyan">
          Layout · چیدمان
        </h2>
      </div>
      <p className="mb-4 font-mono text-[11px] text-muted-foreground">
        شکل کارت‌های کلاینت و چیدمان کلی داشبورد. مستقل از رنگ — هر چیدمان با هر ۶ رنگ کار می‌کنه.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {LAYOUTS.map((L) => {
          const active = L.id === layout;
          return (
            <button
              key={L.id}
              onClick={() => {
                saveLayout(L.id);
                setLayout(L.id);
              }}
              className={
                "group relative overflow-hidden rounded-lg border p-3 text-left transition " +
                (active
                  ? "border-cyan-400/70 bg-cyan-500/10 shadow-[0_0_20px_-6px_var(--neon-cyan)]"
                  : "border-border/60 bg-surface/40 hover:border-cyan-500/50 hover:bg-cyan-500/[0.05]")
              }
            >
              <LayoutPreview id={L.id} />
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
                    {L.name}
                  </div>
                  <div className="font-fa text-[11px] text-muted-foreground" lang="fa">
                    {L.fa}
                  </div>
                </div>
                {active && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <div className="mt-2 font-mono text-[10px] leading-snug text-muted-foreground/80">
                {L.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Text size ──────────────────────────────────────────────── */}
      <div className="mt-8 mb-4 flex items-center gap-2">
        <Type size={16} className="text-cyan-300" />
        <h2 className="font-mono text-sm font-bold uppercase tracking-[0.25em] text-glow-cyan">
          Text Size · اندازه متن‌ها
        </h2>
      </div>
      <p className="mb-4 font-mono text-[11px] text-muted-foreground">
        روی کل داشبورد اثر می‌ذاره — هم فارسی هم انگلیسی. اندازه هدر و فوتر جدا تنظیم می‌شه و همیشه
        روی اندازه کلی «اضافه» می‌شه، نه جایگزینش.
      </p>

      <div className="flex flex-col gap-4 rounded-lg border border-cyan-500/20 bg-surface/40 p-3 sm:flex-row sm:items-center sm:gap-6">
        <label className="flex flex-1 flex-col gap-2">
          <span className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            اندازه کلی متن‌ها{" "}
            <span className="text-foreground">{Math.round(scale.base * 100)}%</span>
          </span>
          <input
            type="range"
            min={UI_SCALE_LIMITS.base.min}
            max={UI_SCALE_LIMITS.base.max}
            step={UI_SCALE_LIMITS.base.step}
            value={scale.base}
            onChange={(e) => updateScale({ base: Number(e.target.value) })}
            className="w-full accent-cyan-400"
          />
        </label>

        <label className="flex flex-1 flex-col gap-2">
          <span className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            اندازه اضافه هدر/فوتر{" "}
            <span className="text-foreground">+{Math.round((scale.header - 1) * 100)}%</span>
          </span>
          <input
            type="range"
            min={UI_SCALE_LIMITS.header.min}
            max={UI_SCALE_LIMITS.header.max}
            step={UI_SCALE_LIMITS.header.step}
            value={scale.header}
            onChange={(e) => updateScale({ header: Number(e.target.value) })}
            className="w-full accent-cyan-400"
          />
        </label>

        <button
          onClick={() => updateScale(DEFAULT_UI_SCALE)}
          className="flex items-center gap-1.5 self-start rounded border border-border/60 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground sm:self-center"
        >
          <RotateCcw size={11} /> ریست
        </button>
      </div>

      {/* ── Scrollbar ──────────────────────────────────────────────── */}
      <div className="mt-8 mb-4 flex items-center gap-2">
        <MousePointer2 size={16} className="text-cyan-300" />
        <h2 className="font-mono text-sm font-bold uppercase tracking-[0.25em] text-glow-cyan">
          Scrollbar · اسکرول‌بار
        </h2>
      </div>
      <p className="mb-4 font-mono text-[11px] text-muted-foreground">
        رنگ خود اسکرول، رنگ زمینه‌ی پشت اون، و عرضش رو تنظیم کن. تغییرات فوری روی کل پروژه اعمال
        می‌شه.
      </p>

      <div className="flex flex-col gap-4 rounded-lg border border-cyan-500/20 bg-surface/40 p-3 sm:flex-row sm:items-center sm:gap-6">
        <label className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-start">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            رنگ اسکرول
          </span>
          <input
            type="color"
            value={scroll.thumbColor}
            onChange={(e) => updateScroll({ thumbColor: e.target.value })}
            className="h-9 w-16 cursor-pointer rounded border border-border/60 bg-transparent p-0.5"
          />
        </label>

        <label className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-start">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            رنگ زمینه اسکرول
          </span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={scroll.trackColor === "transparent" ? "#000000" : scroll.trackColor}
              onChange={(e) => updateScroll({ trackColor: e.target.value })}
              className="h-9 w-16 cursor-pointer rounded border border-border/60 bg-transparent p-0.5"
            />
            <button
              onClick={() => updateScroll({ trackColor: "transparent" })}
              className={
                "rounded border px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider " +
                (scroll.trackColor === "transparent"
                  ? "border-cyan-400/70 bg-cyan-500/10 text-cyan-300"
                  : "border-border/60 text-muted-foreground hover:text-foreground")
              }
            >
              شفاف
            </button>
          </div>
        </label>

        <label className="flex flex-1 flex-col gap-2">
          <span className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            عرض اسکرول <span className="text-foreground">{scroll.width}px</span>
          </span>
          <input
            type="range"
            min={3}
            max={16}
            step={1}
            value={scroll.width}
            onChange={(e) => updateScroll({ width: Number(e.target.value) })}
            className="w-full accent-cyan-400"
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={scroll.glow}
            onChange={(e) => updateScroll({ glow: e.target.checked })}
            className="size-4 accent-cyan-400"
          />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            درخشش نئونی
          </span>
        </label>

        <button
          onClick={() => updateScroll(DEFAULT_SCROLLBAR_SETTINGS)}
          className="flex items-center gap-1.5 self-start rounded border border-border/60 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground sm:self-center"
        >
          <RotateCcw size={11} /> ریست
        </button>
      </div>

      {/* Live preview strip so the effect is visible without hunting for a scrollbar. */}
      <div className="thin-scroll mt-3 h-16 overflow-y-scroll rounded-md border border-cyan-500/20 bg-black/40 p-2 font-mono text-[10px] text-muted-foreground">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i}>preview line {i + 1} — پیش‌نمایش اسکرول</div>
        ))}
      </div>
    </section>
  );
}

// Tiny SVG-ish thumbnail so users can see the shape they're picking.
function LayoutPreview({ id }: { id: LayoutId }) {
  const box = "absolute rounded-sm bg-cyan-400/40 border border-cyan-300/60";
  if (id === "grid") {
    return (
      <div className="relative h-16 w-full rounded-md bg-black/40">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={box}
            style={{
              left: `${(i % 3) * 33 + 4}%`,
              top: `${Math.floor(i / 3) * 45 + 8}%`,
              width: "26%",
              height: "34%",
            }}
          />
        ))}
      </div>
    );
  }
  if (id === "honeycomb") {
    return (
      <div className="relative h-16 w-full rounded-md bg-black/40">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="absolute border border-cyan-300/60 bg-cyan-400/40"
            style={{
              left: `${(i % 3) * 32 + (Math.floor(i / 3) % 2 ? 12 : 4)}%`,
              top: `${Math.floor(i / 3) * 40 + 8}%`,
              width: "22%",
              height: "34%",
              clipPath:
                "polygon(12% 0, 88% 0, 100% 15%, 100% 85%, 88% 100%, 12% 100%, 0 85%, 0 15%)",
            }}
          />
        ))}
      </div>
    );
  }
  if (id === "orbit") {
    return (
      <div className="relative h-16 w-full rounded-md bg-black/40">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute rounded-full border-2 border-cyan-300/70 bg-cyan-400/20"
            style={{
              left: `${i * 24 + 4}%`,
              top: "20%",
              width: "20%",
              height: "60%",
              boxShadow: "0 0 8px var(--neon-cyan)",
            }}
          />
        ))}
      </div>
    );
  }
  // strip
  return (
    <div className="relative h-16 w-full rounded-md bg-black/40 p-1">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="absolute left-1 right-1 rounded-sm bg-cyan-400/40 border-l-2 border-cyan-300"
          style={{ top: `${i * 24 + 4}%`, height: "18%" }}
        />
      ))}
    </div>
  );
}
