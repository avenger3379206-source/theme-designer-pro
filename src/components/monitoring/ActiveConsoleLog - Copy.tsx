import { useEffect, useRef, useState, useCallback } from "react";
import {
  Terminal,
  Plus,
  X,
  Pencil,
  Check,
  RefreshCw,
  Trash2,
} from "lucide-react";
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

const POLL_MS = 30_000;
const MAX_DNS = 10;

/**
 * Active Console Log — DNS ranking panel.
 *
 * One row per configured DNS. Every 30s we ping both DNS IPs for each entry
 * and re-render the list (no scroll), ranked by the best of the two. Each
 * row shows dns1 and dns2 latency separately (not just the merged best),
 * with its own rank/name/border so it's unambiguous which reading belongs
 * to which host.
 *
 * DNS management (add/edit/delete, max 10) lives inside the +dns modal.
 */
export function ActiveConsoleLog() {
  const [hosts, setHosts] = useState<ConsoleHost[]>(() => loadConsoleHosts());
  const [entries, setEntries] = useState<ConsoleLogEntry[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; dns1: string; dns2: string }>({
    name: "",
    dns1: "",
    dns2: "",
  });
  const [lastCycle, setLastCycle] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const statsRef = useRef<Record<string, boolean[]>>({});
  const draftNameRef = useRef<HTMLInputElement>(null);

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
      setIsPolling(true);
      try {
        const targets: { hostId: string; field: "dns1" | "dns2"; value: string }[] = [];
        for (const h of hosts) {
          if (h.dns1) targets.push({ hostId: h.id, field: "dns1", value: h.dns1 });
          if (h.dns2) targets.push({ hostId: h.id, field: "dns2", value: h.dns2 });
        }
        const pings = await pingAll(targets.map((t) => t.value));
        if (!alive) return;
        const now = Date.now();
        setLastCycle(now);

        const byHost: Record<string, { ms1: number; ms2: number }> = {};
        targets.forEach((t, i) => {
          const ms = pings[i];
          const ok = typeof ms === "number" && ms >= 0;
          if (!byHost[t.hostId]) byHost[t.hostId] = { ms1: -1, ms2: -1 };
          if (t.field === "dns1") byHost[t.hostId].ms1 = ok ? ms : -1;
          else byHost[t.hostId].ms2 = ok ? ms : -1;
        });

        const fresh: ConsoleLogEntry[] = hosts.map((h) => {
          const { ms1, ms2 } = byHost[h.id] || { ms1: -1, ms2: -1 };
          const candidates = [ms1, ms2].filter((m) => m >= 0);
          const best = candidates.length > 0 ? Math.min(...candidates) : -1;
          const quality = qualityFromMs(best);
          const arr = statsRef.current[h.id] || (statsRef.current[h.id] = []);
          arr.push(best >= 0);
          if (arr.length > 30) arr.shift();
          return {
            id: `${now}-${h.id}`,
            hostId: h.id,
            t: now,
            name: h.name,
            dns1: h.dns1,
            dns2: h.dns2,
            ms1,
            ms2,
            ms: best,
            quality,
          };
        });

        fresh.sort((a, b) => {
          if (a.ms < 0 && b.ms < 0) return 0;
          if (a.ms < 0) return 1;
          if (b.ms < 0) return -1;
          return a.ms - b.ms;
        });

        setEntries(fresh);
      } finally {
        if (alive) setIsPolling(false);
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [hosts, autoRefresh]);

  const openModal = useCallback(() => {
    setEditingId(null);
    setDraft({ name: "", dns1: "", dns2: "" });
    setShowModal(true);
    setTimeout(() => draftNameRef.current?.focus(), 50);
  }, []);

  const startEdit = useCallback((h: ConsoleHost) => {
    setEditingId(h.id);
    setDraft({ name: h.name, dns1: h.dns1, dns2: h.dns2 });
    setTimeout(() => draftNameRef.current?.focus(), 50);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDraft({ name: "", dns1: "", dns2: "" });
  }, []);

  const saveDraft = useCallback(() => {
    const name = draft.name.trim();
    const dns1 = draft.dns1.trim();
    const dns2 = draft.dns2.trim();
    if (!name || (!dns1 && !dns2)) return;
    let next: ConsoleHost[];
    if (editingId) {
      next = hosts.map((h) =>
        h.id === editingId ? { ...h, name, dns1, dns2 } : h,
      );
      setEditingId(null);
    } else {
      if (hosts.length >= MAX_DNS) return;
      next = [...hosts, { id: makeConsoleHostId(), name, dns1, dns2 }];
    }
    setHosts(next);
    saveConsoleHosts(next);
    setDraft({ name: "", dns1: "", dns2: "" });
  }, [draft, editingId, hosts]);

  const removeHost = useCallback((id: string) => {
    const next = hosts.filter((h) => h.id !== id);
    setHosts(next);
    saveConsoleHosts(next);
    delete statsRef.current[id];
    if (editingId === id) {
      setEditingId(null);
      setDraft({ name: "", dns1: "", dns2: "" });
    }
  }, [hosts, editingId]);

  const cycleTimeStr = lastCycle
    ? new Date(lastCycle).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  const canAdd = hosts.length < MAX_DNS && !editingId;
  const showForm = editingId !== null || canAdd;

  return (
    <div className="rounded-xl p-2.5 glass-panel">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3
          className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.3em]"
          style={{ color: "var(--neon-cyan)", textShadow: "0 0 6px var(--neon-cyan)55" }}
        >
          <Terminal size={12} /> active console log
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            title="فعال/غیرفعال کردن رفرش خودکار"
            className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest"
            style={{ color: autoRefresh ? "var(--neon-cyan)" : "oklch(0.55 0.02 250)" }}
          >
            <RefreshCw size={10} className={isPolling ? "animate-spin" : ""} />
            {autoRefresh ? "ON" : "OFF"}
          </button>
          <button
            onClick={openModal}
            title="مدیریت DNS"
            className="flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 font-mono text-[9px] text-muted-foreground transition hover:border-cyan-400/60 hover:text-cyan-300"
          >
            <Plus size={10} /> dns
          </button>
        </div>
      </div>

      {/* DNS list — ranked, one card per host. Each row shows dns1 and dns2
          latency as separate, individually-colored readings (not just the
          merged "best") plus its own border/stripe, so it's unambiguous
          which ping number belongs to which host and which DNS IP. */}
      <div
        dir="ltr"
        className="flex flex-col gap-1 overflow-hidden rounded-md border border-border/60 bg-black/50 p-1.5"
      >
        {entries.length === 0 ? (
          <div className="flex h-16 items-center justify-center px-2 text-center font-mono text-[10px] text-muted-foreground">
            {hosts.length === 0
              ? "add a DNS to start monitoring"
              : isPolling
                ? "pinging…"
                : "waiting for first cycle…"}
          </div>
        ) : (
          entries.map((e, idx) => {
            const overallColor = qualityColor(e.quality);
            const dns1Color = e.ms1 >= 0 ? qualityColor(qualityFromMs(e.ms1)) : "var(--neon-red)";
            const dns2Color = e.ms2 >= 0 ? qualityColor(qualityFromMs(e.ms2)) : "var(--neon-red)";
            const rank = idx + 1;
            return (
              <div
                key={e.hostId}
                className={`flex items-center gap-2 rounded-md border border-border/40 px-2 py-1.5 font-mono text-[10px] leading-tight ${
                  idx % 2 === 1 ? "bg-white/[0.03]" : ""
                }`}
                title={`${e.name} — ${e.dns1}${e.dns2 ? ` / ${e.dns2}` : ""}`}
              >
                <span
                  className="h-6 w-1 shrink-0 rounded-full"
                  style={{ background: overallColor, boxShadow: `0 0 6px ${overallColor}` }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-4 shrink-0 text-[9px] text-foreground/40">#{rank}</span>
                    <span
                      className="truncate font-semibold"
                      style={{ color: "oklch(0.82 0.18 60)" }}
                    >
                      {e.name}
                    </span>
                    <span
                      className="ml-auto shrink-0 text-[9px] font-bold lowercase tracking-wider"
                      style={{ color: overallColor }}
                    >
                      {qualityLabel(e.quality)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 truncate text-[9px] text-foreground/55">
                    <span className="shrink-0 truncate">
                      <span className="text-foreground/40">dns1</span>{" "}
                      <span className="font-semibold" style={{ color: dns1Color }}>
                        {e.dns1 ? (e.ms1 >= 0 ? `${e.ms1}ms` : "timeout") : "—"}
                      </span>
                    </span>
                    {e.dns2 && (
                      <span className="shrink-0 truncate">
                        <span className="text-foreground/40">dns2</span>{" "}
                        <span className="font-semibold" style={{ color: dns2Color }}>
                          {e.ms2 >= 0 ? `${e.ms2}ms` : "timeout"}
                        </span>
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-foreground/35">[{cycleTimeStr}]</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DNS Management Modal — list + add/edit, max 10 */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
            dir="rtl"
          >
            {/* Modal header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border/40 p-3">
              <h4
                className="font-mono text-xs uppercase tracking-widest"
                style={{ color: "var(--neon-cyan)" }}
              >
                مدیریت DNS
              </h4>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-muted-foreground">
                  {hosts.length}/{MAX_DNS}
                </span>
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded p-1 text-muted-foreground transition hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Modal body — scrollable list + form */}
            <div className="flex flex-col gap-3 overflow-y-auto p-3">
              {/* Configured DNS list with edit/delete */}
              {hosts.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="mb-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                    configured dns
                  </div>
                  {hosts.map((h) => (
                    <div
                      key={h.id}
                      dir="ltr"
                      className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] transition ${
                        editingId === h.id
                          ? "border-cyan-400/50 bg-cyan-400/5"
                          : "border-border/40 bg-black/30 hover:bg-white/5"
                      }`}
                    >
                      <span className="truncate font-semibold text-foreground/85">{h.name}</span>
                      <span className="truncate text-foreground/45">
                        {h.dns1}{h.dns2 ? ` / ${h.dns2}` : ""}
                      </span>
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => startEdit(h)}
                          title="ویرایش"
                          className="rounded p-0.5 text-foreground/40 transition hover:text-cyan-300"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={() => removeHost(h.id)}
                          title="حذف"
                          className="rounded p-0.5 text-foreground/40 transition hover:text-red-400"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add / Edit form */}
              {showForm ? (
                <div className="flex flex-col gap-2 border-t border-border/40 pt-2.5">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                    {editingId ? "ویرایش DNS" : "افزودن DNS جدید"}
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      نام DNS
                    </span>
                    <input
                      ref={draftNameRef}
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Cloudflare"
                      dir="ltr"
                      className="rounded border border-border/60 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-foreground outline-none focus:border-cyan-400/60"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      DNS 1 (Primary)
                    </span>
                    <input
                      value={draft.dns1}
                      onChange={(e) => setDraft((d) => ({ ...d, dns1: e.target.value }))}
                      placeholder="e.g. 1.1.1.1"
                      dir="ltr"
                      className="rounded border border-border/60 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-foreground outline-none focus:border-cyan-400/60"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      DNS 2 (Secondary — optional)
                    </span>
                    <input
                      value={draft.dns2}
                      onChange={(e) => setDraft((d) => ({ ...d, dns2: e.target.value }))}
                      placeholder="e.g. 1.0.0.1"
                      dir="ltr"
                      className="rounded border border-border/60 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-foreground outline-none focus:border-cyan-400/60"
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    {editingId && (
                      <button
                        onClick={cancelEdit}
                        className="rounded border border-border/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
                      >
                        cancel edit
                      </button>
                    )}
                    <button
                      onClick={saveDraft}
                      disabled={!draft.name.trim() || (!draft.dns1.trim() && !draft.dns2.trim())}
                      className="flex items-center gap-1 rounded border border-cyan-400/50 bg-cyan-400/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Check size={11} />
                      {editingId ? "save" : "add"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-border/40 pt-2.5 text-center font-mono text-[10px] text-muted-foreground">
                  حداکثر {MAX_DNS} DNS — برای افزودن، یکی را حذف کنید.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
