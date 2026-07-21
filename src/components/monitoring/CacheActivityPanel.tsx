import { useEffect, useMemo, useState } from "react";
import { Database, Zap, Cloud, Activity, CheckCircle2, XCircle, CircleDashed } from "lucide-react";
import {
  aggregate,
  fetchCacheTail,
  loadCacheSsh,
  parseCacheLine,
  type CacheLine,
  type CacheSshConfig,
  type ClientCache,
} from "@/lib/cache-activity";
import { isComposing } from "@/lib/compose-lock";
import { machineFromIp } from "@/lib/cache-activity";
import { recordBytes } from "@/lib/daily-report";

const POLL_MS = 3000;
const WINDOW_MS = 15_000;
const MAX_KEEP = 800;
// Broadcast per-client cache state so ClientCard can subscribe.
export const CACHE_EVT = "exir:cache-clients";
export const CACHE_LINES_EVT = "exir:cache-lines";

export function CacheActivityPanel() {
  const [cfg, setCfg] = useState<CacheSshConfig>(() => loadCacheSsh());
  const [lines, setLines] = useState<CacheLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = () => setCfg(loadCacheSsh());
    window.addEventListener("exir:cache-ssh", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("exir:cache-ssh", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  useEffect(() => {
    if (!cfg.enabled || !cfg.host || !cfg.user) return;
    let alive = true;
    const seen = new Set<string>();
    async function tick() {
      if (isComposing()) return;
      const r = await fetchCacheTail(cfg, 300);
      if (!alive) return;
      if (!r.ok) { setError(r.error || "ssh error"); return; }
      setError(null);
      const parsed: CacheLine[] = [];
      for (const raw of r.lines) {
        if (seen.has(raw)) continue;
        seen.add(raw);
        const p = parseCacheLine(raw);
        if (p) parsed.push(p);
      }
      if (parsed.length === 0) return;
      // Feed daily-report per-machine + per-service byte totals.
      for (const p of parsed) {
        const machine = machineFromIp(p.ip);
        if (machine && p.bytes > 0) recordBytes(machine, p.service, p.bytes, "down");
      }
      setLines((prev) => {
        const next = [...prev, ...parsed].slice(-MAX_KEEP);
        return next;
      });
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [cfg]);

  const perClient = useMemo(() => aggregate(lines, WINDOW_MS), [lines]);

  // Publish for ClientCard.
  useEffect(() => {
    (window as unknown as { __exirCache?: Record<string, ClientCache> }).__exirCache = perClient;
    window.dispatchEvent(new CustomEvent(CACHE_EVT));
  }, [perClient]);

  // Publish raw parsed lines for EpicCdnDiscovery.
  useEffect(() => {
    (window as unknown as { __exirCacheLines?: CacheLine[] }).__exirCacheLines = lines;
    window.dispatchEvent(new CustomEvent(CACHE_LINES_EVT));
  }, [lines]);

  const summary = useMemo(() => {
    const arr = Object.values(perClient);
    const active = arr.filter((x) => x.mode !== "idle").length;
    const internet = arr.filter((x) => x.misses > 0).length;
    const idle = 12 - active;
    const totalHits = arr.reduce((a, b) => a + b.hits, 0);
    const totalReq = arr.reduce((a, b) => a + b.hits + b.misses, 0);
    const hitRatio = totalReq ? Math.round((totalHits / totalReq) * 100) : 0;
    const speed = arr.reduce((a, b) => a + b.speedKBs, 0);
    return { active, internet, idle: Math.max(0, idle), hitRatio, speed };
  }, [perClient]);

  // Split the log lines into three buckets — newest first — one per status
  // column (HIT / MISS / OTHER). Each status is filtered from the *full*
  // history independently (not a shared recent-N window), so a less-common
  // status doesn't get crowded out and appear empty when overall volume is high.
  const { hitLines, missLines, otherLines } = useMemo(() => {
    const byStatus = (pred: (l: CacheLine) => boolean) =>
      lines.filter(pred).slice(-80).reverse();
    return {
      hitLines: byStatus((l) => l.status === "HIT"),
      missLines: byStatus((l) => l.status === "MISS"),
      otherLines: byStatus((l) => l.status !== "HIT" && l.status !== "MISS"),
    };
  }, [lines]);

  // Overall HIT/MISS/OTHER split across the full buffered log — feeds the
  // ratio donut. Deliberately independent of the 80-line display cap above
  // so the chart reflects the whole session, not just what's on screen.
  const ratio = useMemo(() => {
    let hit = 0, miss = 0, other = 0;
    for (const l of lines) {
      if (l.status === "HIT") hit++;
      else if (l.status === "MISS") miss++;
      else other++;
    }
    const total = hit + miss + other;
    return {
      hitPct: total ? Math.round((hit / total) * 100) : 0,
      missPct: total ? Math.round((miss / total) * 100) : 0,
      otherPct: total ? Math.round((other / total) * 100) : 0,
      total,
    };
  }, [lines]);

  const disabled = !cfg.enabled || !cfg.host || !cfg.user;

  return (
    <div className="mb-3 rounded-xl p-3 glass-panel">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          <Database size={12} /> ▸ cache activity · lancache
        </h3>
        {error && <span className="font-mono text-[10px]" style={{ color: "var(--neon-red)" }}>ssh: {error}</span>}
        {disabled && <span className="font-mono text-[10px] text-muted-foreground">configure in Settings</span>}
      </div>

      <div className="grid grid-cols-5 gap-2">
        <Metric label="Active"    value={String(summary.active)}    icon={<Activity size={12} />} color="var(--neon-cyan)" />
        <Metric label="Internet"  value={String(summary.internet)}  icon={<Cloud size={12} />}    color="var(--neon-red)" />
        <Metric label="Idle"      value={String(summary.idle)}      icon={<Database size={12} />} color="oklch(0.6 0.02 250)" />
        <Metric label="Hit Ratio" value={`${summary.hitRatio}%`}    icon={<Zap size={12} />}      color="var(--neon-green)" />
        <Metric label="Speed"     value={`${summary.speed} KB/s`}   icon={<Activity size={12} />} color="var(--neon-magenta)" />
      </div>

      <div className="mt-3 rounded-md border border-border/60 bg-black/40 p-1.5">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">▸ live access.log</span>
          <span className="font-mono text-[9px] text-muted-foreground">{lines.length} lines · {POLL_MS / 1000}s poll</span>
        </div>
        <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-1.5">
          <LogColumn
            label="HIT"
            icon={<CheckCircle2 size={11} />}
            color="var(--neon-green)"
            entries={hitLines}
          />
          <LogColumn
            label="MISS"
            icon={<XCircle size={11} />}
            color="var(--neon-red)"
            entries={missLines}
          />
          <LogColumn
            label="OTHER"
            icon={<CircleDashed size={11} />}
            color="oklch(0.6 0.02 250)"
            entries={otherLines}
          />
          <CacheRatioDonut
            hitPct={ratio.hitPct}
            missPct={ratio.missPct}
            otherPct={ratio.otherPct}
          />
        </div>
      </div>
    </div>
  );
}

function LogColumn({
  label,
  icon,
  color,
  entries,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  entries: CacheLine[];
}) {
  const tint = (pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`;
  return (
    <div className="rounded-lg border p-1.5" style={{ borderColor: tint(40) }}>
      <div
        className="mb-1 flex items-center justify-between border-b pb-1 font-mono text-[9px] font-bold uppercase tracking-widest"
        style={{ borderColor: tint(30), color }}
      >
        <span className="flex items-center gap-1">
          {icon} {label}
        </span>
        <span>{entries.length}</span>
      </div>
      <div
        className="thin-scroll flex flex-col gap-1 overflow-y-auto pe-0.5"
        style={{ maxHeight: 80 }}
      >
        {entries.length === 0 && (
          <span className="flex h-6 items-center justify-center px-1 font-mono text-[9px] text-muted-foreground">
            — no data —
          </span>
        )}
        {entries.map((l, i) => (
          <div
            key={i}
            className="flex h-6 shrink-0 items-center truncate rounded border px-1.5 font-mono text-[10px]"
            style={{ borderColor: tint(55), color }}
            title={l.raw}
          >
            {l.service} · {l.ip.split(".").pop()} · {(l.bytes / 1024).toFixed(0)}KB
          </div>
        ))}
      </div>
    </div>
  );
}

function CacheRatioDonut({
  hitPct,
  missPct,
  otherPct,
}: {
  hitPct: number;
  missPct: number;
  otherPct: number;
}) {
  const hitColor = "var(--neon-green)";
  const missColor = "var(--neon-red)";
  const otherColor = "oklch(0.6 0.02 250)";

  const r = 30;
  const c = 2 * Math.PI * r;
  const hitLen = (hitPct / 100) * c;
  const missLen = (missPct / 100) * c;
  const otherLen = Math.max(c - hitLen - missLen, 0);

  const rows = [
    { label: "HIT", pct: hitPct, color: hitColor },
    { label: "MISS", pct: missPct, color: missColor },
    { label: "OTHER", pct: otherPct, color: otherColor },
  ];

  return (
    <div className="flex h-full items-center gap-2 rounded-lg border border-border/60 bg-surface/50 p-1.5">
      <div className="relative shrink-0">
        <svg viewBox="0 0 72 72" width="60" height="60" className="-rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="oklch(0.32 0.02 250)" strokeWidth="8" />
          {hitLen > 0 && (
            <circle
              cx="36" cy="36" r={r} fill="none" stroke={hitColor} strokeWidth="8"
              strokeDasharray={`${hitLen} ${c - hitLen}`} strokeLinecap="round"
            />
          )}
          {missLen > 0 && (
            <circle
              cx="36" cy="36" r={r} fill="none" stroke={missColor} strokeWidth="8"
              strokeDasharray={`${missLen} ${c - missLen}`} strokeDashoffset={-hitLen} strokeLinecap="round"
            />
          )}
          {otherLen > 0 && (
            <circle
              cx="36" cy="36" r={r} fill="none" stroke={otherColor} strokeWidth="8"
              strokeDasharray={`${otherLen} ${c - otherLen}`} strokeDashoffset={-(hitLen + missLen)} strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[13px] font-black leading-none" style={{ color: hitColor, textShadow: `0 0 6px ${hitColor}55` }}>
            {hitPct}%
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 pe-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest whitespace-nowrap">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: row.color, boxShadow: `0 0 4px ${row.color}` }} />
            <span style={{ color: row.color }}>{row.label}</span>
            <span className="text-muted-foreground">{row.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/50 p-2">
      <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        <span style={{ color }}>{icon}</span> {label}
      </div>
      <div className="mt-0.5 font-mono text-lg font-black leading-none" style={{ color, textShadow: `0 0 6px ${color}55` }}>
        {value}
      </div>
    </div>
  );
}
