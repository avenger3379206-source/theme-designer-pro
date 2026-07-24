import { useEffect, useRef, useState, useCallback } from "react";
import {
  Terminal,
  Plus,
  X,
  Pencil,
  Check,
  ChevronRight,
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
import { SteamEpicStatusBare } from "@/components/monitoring/SteamEpicStatus";

const POLL_MS = 30_000;
const MAX_DNS = 10;
// Below this measured panel width (px) the DNS list and launcher status
// stack vertically; at/above it they sit side by side. Measured directly
// with ResizeObserver instead of a Tailwind breakpoint/container-query
// class, since this panel's real width depends on the page's own layout
// (sidebar, other columns) and not just the browser viewport.
const SPLIT_AT_PX = 520;

// Tracks the live pixel width of an element so layout decisions can react
// to the element's *actual* rendered size, not a viewport media query.
function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") setWidth(w);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Active Console Log — DNS ranking panel with integrated launcher status.
 *
 * One line per configured DNS. Every 30s we ping both DNS IPs for each entry,
 * take the best ping, and re-render the list (no scroll). The launcher status
 * (Steam/Epic) sits next to the DNS list inside the same panel — no separate
 * frame — so vertical height stays compact.
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
  const [splitRef, splitWidth] = useMeasuredWidth<HTMLDivElement>();
  const isWide = splitWidth >= SPLIT_AT_PX;

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

      {/* Two-column: DNS ranked list | launcher status (no separate frame).
          Split is driven by ResizeObserver (isWide), not a CSS breakpoint,
          so it reacts to this panel's real width regardless of page layout. */}
      <div
        ref={splitRef}
        className="grid items-start gap-2"
        style={{ gridTemplateColumns: isWide ? "1fr 1fr" : "1fr" }}
      >
        {/* DNS list — no scroll, one line per DNS, ranked */}
        <div
          dir="ltr"
          className="flex flex-col gap-0.5 overflow-hidden rounded-md border border-border/60 bg-black/50 p-1.5"
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
              const c = qualityColor(e.quality);
              const rank = idx + 1;
              return (
                <div
                  key={e.hostId}
                  className="flex items-center gap-1.5 truncate font-mono text-[10px] leading-tight"
                  title={`${e.name} — ${e.dns1}${e.dns2 ? ` / ${e.dns2}` : ""}`}
                >
                  <span className="shrink-0 text-[9px] text-foreground/55">
                    [{cycleTimeStr}]
                  </span>
                  <span className="shrink-0 w-3 text-[9px] text-foreground/40">#{rank}</span>
                  <span
                    className="shrink-0 truncate max-w-[80px] font-semibold"
                    style={{ color: "oklch(0.82 0.18 60)" }}
                  >
                    {e.name}
                  </span>
                  <ChevronRight size={10} className="shrink-0 text-foreground/40" />
                  <span
                    className="shrink-0 font-bold"
                    style={{ color: c, textShadow: `0 0 4px ${c}55` }}
                  >
                    {e.ms >= 0 ? `${e.ms}ms` : "timeout"}
                  </span>
                  <span
                    className="ml-auto shrink-0 text-[9px] font-bold lowercase tracking-wider"
                    style={{ color: c }}
                  >
                    {qualityLabel(e.quality)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Launcher status — integrated, no separate frame */}
        <SteamEpicStatusBare />
      </div>

      {/* DNS Management Modal — list + add/edit, max 10 */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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
