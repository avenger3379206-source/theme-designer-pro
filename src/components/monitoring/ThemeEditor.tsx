import { useEffect, useState } from "react";
import { Palette, Check, LayoutGrid } from "lucide-react";
import {
  THEMES, loadTheme, saveTheme, type ThemeId,
  LAYOUTS, loadLayout, saveLayout, type LayoutId,
} from "@/lib/theme";

export function ThemeEditor() {
  const [current, setCurrent] = useState<ThemeId>(() => loadTheme());
  const [layout, setLayout] = useState<LayoutId>(() => loadLayout());

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

  return (
    <section className="mb-6 rounded-xl glass-panel p-5 neon-border-cyan">
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
              onClick={() => { saveTheme(t.id); setCurrent(t.id); }}
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
              onClick={() => { saveLayout(L.id); setLayout(L.id); }}
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
    </section>
  );
}

// Tiny SVG-ish thumbnail so users can see the shape they're picking.
function LayoutPreview({ id }: { id: LayoutId }) {
  const box = "absolute rounded-sm bg-cyan-400/40 border border-cyan-300/60";
  if (id === "grid") {
    return (
      <div className="relative h-16 w-full rounded-md bg-black/40">
        {[0,1,2,3,4,5].map((i) => (
          <span
            key={i}
            className={box}
            style={{ left: `${(i%3)*33 + 4}%`, top: `${Math.floor(i/3)*45 + 8}%`, width: "26%", height: "34%" }}
          />
        ))}
      </div>
    );
  }
  if (id === "honeycomb") {
    return (
      <div className="relative h-16 w-full rounded-md bg-black/40">
        {[0,1,2,3,4,5].map((i) => (
          <span
            key={i}
            className="absolute border border-cyan-300/60 bg-cyan-400/40"
            style={{
              left: `${(i%3)*32 + (Math.floor(i/3)%2 ? 12 : 4)}%`,
              top: `${Math.floor(i/3)*40 + 8}%`,
              width: "22%", height: "34%",
              clipPath: "polygon(12% 0, 88% 0, 100% 15%, 100% 85%, 88% 100%, 12% 100%, 0 85%, 0 15%)",
            }}
          />
        ))}
      </div>
    );
  }
  if (id === "orbit") {
    return (
      <div className="relative h-16 w-full rounded-md bg-black/40">
        {[0,1,2,3].map((i) => (
          <span
            key={i}
            className="absolute rounded-full border-2 border-cyan-300/70 bg-cyan-400/20"
            style={{ left: `${i*24 + 4}%`, top: "20%", width: "20%", height: "60%",
              boxShadow: "0 0 8px var(--neon-cyan)" }}
          />
        ))}
      </div>
    );
  }
  // strip
  return (
    <div className="relative h-16 w-full rounded-md bg-black/40 p-1">
      {[0,1,2,3].map((i) => (
        <span
          key={i}
          className="absolute left-1 right-1 rounded-sm bg-cyan-400/40 border-l-2 border-cyan-300"
          style={{ top: `${i*24 + 4}%`, height: "18%" }}
        />
      ))}
    </div>
  );
}
