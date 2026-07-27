import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { loadPlatforms, loadLatencyTargets, type PlatformStatus } from "@/lib/game-platforms";
import { isComposing } from "@/lib/compose-lock";

const REFRESH_MS = 30_000;
const RELAY_REFRESH_MS = 60 * 60 * 1000; // relay IP list itself barely changes

function color(l: PlatformStatus["level"]) {
  return l === "ok" ? "var(--neon-green)"
    : l === "warn" ? "var(--neon-amber)"
    : l === "down" ? "var(--neon-red)"
    : "oklch(0.6 0.02 250)";
}

export function GamePlatformsPanel() {
  const [items, setItems] = useState<PlatformStatus[]>([]);
  const [pings, setPings] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    let alive = true;
    async function tick() {
      if (isComposing()) return;
      const s = await loadPlatforms();
      if (alive) setItems(s);
    }
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Real relay IPs per platform (fetched once per hour — the relay list
  // itself barely changes; see loadLatencyTargets in game-platforms.ts).
  const [targets, setTargets] = useState<Record<string, { region: string; host: string }[]>>({});

  useEffect(() => {
    let alive = true;
    async function loadTargets() {
      const t = await loadLatencyTargets();
      if (alive) setTargets(t);
    }
    loadTargets();
    const id = setInterval(loadTargets, RELAY_REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    let alive = true;
    async function tickLat() {
      if (isComposing()) return;
      const entries = Object.entries(targets);
      if (!entries.length) return;
      const flat: { plat: string; region: string; host: string }[] = [];
      for (const [plat, arr] of entries) for (const t of arr) flat.push({ plat, region: t.region, host: t.host });
      try {
        const r = await fetch("http://localhost:8765/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hosts: flat.map((f) => f.host) }),
        });
        const json = (await r.json()) as { results?: number[] };
        if (!alive) return;
        const next: Record<string, Record<string, number>> = {};
        flat.forEach((f, i) => {
          const v = json.results?.[i] ?? -1;
          next[f.plat] = next[f.plat] || {};
          next[f.plat][f.region] = v;
        });
        setPings(next);
      } catch { /* agent offline */ }
    }
    tickLat();
    const id = setInterval(tickLat, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, [targets]);

  const down = items.find((x) => x.level === "down");

  return (
    <div className="rounded-xl p-3 glass-panel">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          <Gamepad2 size={12} /> ▸ game platforms
        </h3>
        {down && (
          <span className="font-mono text-[10px] uppercase" style={{ color: "var(--neon-red)" }}>
            {down.name} <span className="font-fa normal-case" lang="fa">مشکل دارد</span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((p) => (
          <div key={p.key} className="rounded-lg border border-border/60 bg-surface/50 p-2 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: color(p.level), boxShadow: `0 0 6px ${color(p.level)}` }} />
              <span className="font-mono text-[11px] font-bold" style={{ color: color(p.level) }}>{p.name}</span>
            </div>
            <div className="mt-0.5 font-mono text-[9px] uppercase text-muted-foreground">{p.level}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        {Object.entries(targets).map(([plat, regionTargets]) => {
          // Sort by best (lowest) ping first. Losses (-1) and not-yet-measured
          // (undefined) always sink to the bottom, in that order.
          const rows = regionTargets
            .map((t) => ({ ...t, v: pings[plat]?.[t.region] }))
            .sort((a, b) => {
              const rank = (v: number | undefined) => (v === undefined ? Infinity : v < 0 ? 1e9 : v);
              return rank(a.v) - rank(b.v);
            });
          return (
            <div key={plat} className="rounded-lg border border-border/60 bg-surface/40 p-2">
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-glow-cyan">
                <span>{plat} latency</span>
                <span className="normal-case tracking-normal text-muted-foreground">{rows.length} سرور</span>
              </div>
              {/* Fixed height ≈ 10 rows; scrolls for anything beyond that. */}
              <div className="max-h-[248px] space-y-0 overflow-y-auto pr-1">
                {rows.map((t, i) => {
                  const v = t.v;
                  const c = v === undefined ? "text-muted-foreground" : v < 0 ? "text-rose-400" : v < 60 ? "text-emerald-300" : v < 120 ? "text-amber-300" : "text-rose-400";
                  return (
                    <div
                      key={t.region}
                      className={`flex items-center gap-2 border-b border-border/20 py-1 last:border-b-0 ${i % 2 === 1 ? "bg-white/[0.03]" : ""}`}
                    >
                      <span className="w-4 shrink-0 text-right font-mono text-[9px] text-muted-foreground/50">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{t.region}</span>
                      <span className={`w-14 shrink-0 text-right font-mono text-[11px] tabular-nums ${c}`}>
                        {v === undefined ? "…" : v < 0 ? "—" : `${v}ms`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
