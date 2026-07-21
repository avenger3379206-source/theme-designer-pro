import { useEffect, useRef, useState } from "react";
import { Terminal, Plus, X, CheckCircle2 } from "lucide-react";
import { pingAll } from "@/lib/ping";
import { isComposing } from "@/lib/compose-lock";
import {
  loadConsoleHosts,
  saveConsoleHosts,
  makeConsoleHostId,
  qualityFromMs,
  qualityLabel,
  qualityColor,
  type ConsoleHost,
  type ConsoleLogEntry,
} from "@/lib/console-log";

const POLL_MS = 2000;
const MAX_LOG = 60;
const ROLLING_WINDOW = 30; // checks kept per host for the reliability score

export function ActiveConsoleLog() {
  const [hosts, setHosts] = useState<ConsoleHost[]>(() => loadConsoleHosts());
  const [entries, setEntries] = useState<ConsoleLogEntry[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const statsRef = useRef<Record<string, boolean[]>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = () => setHosts(loadConsoleHosts());
    window.addEventListener("exir:console-hosts", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("exir:console-hosts", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  useEffect(() => {
    if (!autoRefresh || hosts.length === 0) return;
    let alive = true;
    async function tick() {
      if (isComposing()) return;
      const results = await pingAll(hosts.map((h) => h.label));
      if (!alive) return;
      const now = Date.now();
      const fresh: ConsoleLogEntry[] = hosts.map((h, i) => {
        const ms = results[i];
        const ok = typeof ms === "number" && ms >= 0;
        const arr = statsRef.current[h.id] || (statsRef.current[h.id] = []);
        arr.push(ok);
        if (arr.length > ROLLING_WINDOW) arr.shift();
        const score = Math.round((arr.filter(Boolean).length / arr.length) * 100);
        return {
          id: `${now}-${h.id}`,
          t: now,
          host: h.label,
          ms: ok ? ms : -1,
          quality: qualityFromMs(ok ? ms : -1),
          score,
        };
      });
      setEntries((prev) => [...fresh, ...prev].slice(0, MAX_LOG));
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [hosts, autoRefresh]);

  function addHost() {
    const label = draft
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "");
    if (!label) {
      setAdding(false);
      return;
    }
    const next = [...hosts, { id: makeConsoleHostId(), label }];
    setHosts(next);
    saveConsoleHosts(next);
    setDraft("");
    setAdding(false);
  }

  function removeHost(id: string) {
    const next = hosts.filter((h) => h.id !== id);
    setHosts(next);
    saveConsoleHosts(next);
    delete statsRef.current[id];
  }

  return (
    <div className="rounded-xl p-2.5 glass-panel">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3
          className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.3em]"
          style={{ color: "var(--neon-cyan)", textShadow: "0 0 6px var(--neon-cyan)55" }}
        >
          <Terminal size={12} /> active console log
        </h3>
        {!adding ? (
          <button
            onClick={() => {
              setAdding(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            title="افزودن DNS/هاست برای مانیتور"
            className="flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 font-mono text-[9px] text-muted-foreground hover:border-cyan-400/60 hover:text-cyan-300"
          >
            <Plus size={10} /> dns
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addHost();
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              onBlur={() => {
                if (!draft.trim()) setAdding(false);
              }}
              placeholder="e.g. akamaized.net"
              dir="ltr"
              className="w-28 rounded border border-border/60 bg-black/40 px-1.5 py-0.5 font-mono text-[9px] text-foreground outline-none focus:border-cyan-400/60"
            />
            <button
              onClick={addHost}
              className="rounded border border-cyan-400/40 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300 hover:bg-cyan-400/10"
            >
              add
            </button>
          </div>
        )}
      </div>

      {hosts.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {hosts.map((h) => (
            <span
              key={h.id}
              dir="ltr"
              className="flex items-center gap-1 rounded-full border border-border/60 bg-black/30 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
            >
              {h.label}
              <button
                onClick={() => removeHost(h.id)}
                title="حذف"
                className="opacity-40 transition hover:text-red-400 hover:opacity-100"
              >
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        dir="ltr"
        className="thin-scroll flex flex-col gap-0.5 overflow-y-auto rounded-md border border-border/60 bg-black/50 p-1.5"
        style={{ maxHeight: 150 }}
      >
        {entries.length === 0 ? (
          <div className="flex h-16 items-center justify-center px-2 text-center font-mono text-[10px] text-muted-foreground">
            {hosts.length === 0
              ? "add a DNS/host above to start monitoring"
              : "waiting for first ping…"}
          </div>
        ) : (
          entries.map((e) => {
            const c = qualityColor(e.quality);
            return (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 truncate font-mono text-[10px] leading-tight"
                style={{ color: c }}
                title={e.host}
              >
                <span className="truncate">
                  <span className="text-muted-foreground">
                    [{new Date(e.t).toLocaleTimeString()}]
                  </span>{" "}
                  {e.host} -&gt; {e.ms >= 0 ? `${e.ms} ms` : "timeout"}
                  {e.ms >= 0 && (
                    <span className="text-muted-foreground"> ({qualityLabel(e.quality)})</span>
                  )}
                </span>
                <span className="shrink-0 font-bold">{e.score}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-end">
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          title="فعال/غیرفعال کردن رفرش خودکار"
          className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest"
          style={{ color: autoRefresh ? "var(--neon-cyan)" : "oklch(0.55 0.02 250)" }}
        >
          <CheckCircle2 size={11} style={{ opacity: autoRefresh ? 1 : 0.35 }} />
          Auto Refresh: {autoRefresh ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
