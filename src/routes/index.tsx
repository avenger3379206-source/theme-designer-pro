import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Settings, Store } from "lucide-react";
import bgImage from "@/assets/bg-gaming.jpg";
import { generateMockClients, generateMockServer } from "@/lib/monitoring-mock";
import type { ClientStatus, PingTarget, ServerStatus } from "@/lib/monitoring-types";
import { loadTargets, pingAll, pushHistory, saveTargets } from "@/lib/ping";
import {
  clearDirHandle,
  ensurePermission,
  isFileSystemAccessSupported,
  loadDirHandle,
  pickStatusDirectory,
  readAllClients,
  readServer,
} from "@/lib/monitoring-source";
import { ServerCard } from "@/components/monitoring/ServerCard";
import { ClientLayoutView } from "@/components/monitoring/ClientLayoutView";
import { PingPanel } from "@/components/monitoring/PingPanel";
import { ClientDetailModal } from "@/components/monitoring/ClientDetailModal";
import { VncQuickLaunch } from "@/components/monitoring/VncQuickLaunch";
import { SteamEpicStatus } from "@/components/monitoring/SteamEpicStatus";
import { ActiveConsoleLog } from "@/components/monitoring/ActiveConsoleLog";
import { QosLaunch } from "@/components/monitoring/QosLaunch";
import { GamePlatformsPanel } from "@/components/monitoring/GamePlatformsPanel";
import { ReservationBoard } from "@/components/monitoring/ReservationBoard";
import { DailyReport } from "@/components/monitoring/DailyReport";
import { CacheActivityPanel } from "@/components/monitoring/CacheActivityPanel";
import { EpicCdnDiscovery } from "@/components/monitoring/EpicCdnDiscovery";
import { ClientPingProbe } from "@/components/monitoring/ClientPingProbe";
import { HotspotStatus } from "@/components/monitoring/HotspotStatus";
import { InfraStatusPanel } from "@/components/monitoring/InfraStatusPanel";
import { loadReservations, remainingMinutes, defaultSeats } from "@/lib/reservations";
import { loadLogo } from "@/lib/branding";
import { loadSettings, type GaugeSettings } from "@/lib/gauge-settings";
import { recordTick as recordProcessTick } from "@/lib/process-history";
import { isComposing } from "@/lib/compose-lock";
import { recordPing, recordSteamDown, recordUsage } from "@/lib/daily-report";

// --- نمایش/مخفی‌کردن بخش‌های صفحه ---
// هر کدوم رو false کنی، اون بخش کلاً رندر نمی‌شه.
const SHOW_SERVER_CARD = true;
const SHOW_VNC_QUICK_LAUNCH = false;
const SHOW_QOS_LAUNCH = true;
const SHOW_CLIENTS_GRID = true;
const SHOW_CACHE_ACTIVITY = true;
const SHOW_PING = true;
const SHOW_EPIC_CDN_DISCOVERY = true;
const SHOW_STEAM_EPIC_STATUS = true;
const SHOW_ACTIVE_CONSOLE_LOG = true;
const SHOW_GAME_PLATFORMS = true;
const SHOW_RESERVATION_BOARD = true;
const SHOW_DAILY_REPORT = true;
// Phase 9: the "Server OK" pill was replaced up top by the market shop
// icon. Kept behind this flag in case it needs to come back later — set
// to `true` to show it again (it'll appear next to the market icon).
const SHOW_SERVER_STATUS_PILL = false;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Exir Gamenet Monitoring" },
      {
        name: "description",
        content: "Real-time gaming center monitoring dashboard for 12 client stations and server.",
      },
    ],
  }),
  component: Dashboard,
});

type SourceMode = "mock" | "live";

// Persisted alongside gauge settings etc: the moment the dashboard was first
// opened. Reused on every remount/reload so "uptime" keeps counting instead
// of resetting whenever the user visits the shop and comes back.
const UPTIME_START_KEY = "exir.dashboard.started-at";

function loadUptimeStart(): number {
  try {
    const raw = localStorage.getItem(UPTIME_START_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    /* ignore (non-browser context) */
  }
  const now = Date.now();
  try {
    localStorage.setItem(UPTIME_START_KEY, String(now));
  } catch {
    /* ignore quota errors */
  }
  return now;
}

function Dashboard() {
  const [server, setServer] = useState<ServerStatus | null>(null);
  const [clients, setClients] = useState<ClientStatus[]>([]);
  const [pings, setPings] = useState<PingTarget[]>(() => loadTargets());
  const [selected, setSelected] = useState<ClientStatus | null>(null);
  const closeDetail = useCallback(() => setSelected(null), []);
  // Uptime counts up from the moment the dashboard was opened — persisted so
  // it survives leaving/returning from the shop, or a real page refresh,
  // instead of snapping back to 00:00:00 every time.
  const startRef = useRef<number>(loadUptimeStart());
  const [uptime, setUptime] = useState("00:00:00");
  const [now, setNow] = useState("");

  const [mode, setMode] = useState<SourceMode>("mock");
  const [folderName, setFolderName] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const dirRef = useRef<FileSystemDirectoryHandle | null>(null);
  const pingsRef = useRef<PingTarget[]>(pings);
  useEffect(() => {
    pingsRef.current = pings;
  }, [pings]);
  // hydration-safe: File System Access API is browser-only, so start with
  // `false` on the server and flip to the real value after mount.
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(isFileSystemAccessSupported());
  }, []);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  // True once we've finished trying to restore a previously-granted live
  // folder (success or not). Prevents a brief "mock" flash on every mount.
  const [sourceReady, setSourceReady] = useState(false);
  const [gaugeSettings, setGaugeSettings] = useState<GaugeSettings>(() => loadSettings());
  useEffect(() => {
    const h = () => setGaugeSettings(loadSettings());
    window.addEventListener("exir:gauge-settings", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("exir:gauge-settings", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  useEffect(() => {
    let currentUrl: string | null = null;
    async function refresh() {
      const l = await loadLogo();
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = l ? URL.createObjectURL(l.blob) : null;
      setLogoUrl(currentUrl);
    }
    refresh();
    const h = () => refresh();
    window.addEventListener("exir:logo-changed", h);
    return () => {
      window.removeEventListener("exir:logo-changed", h);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, []);

  // data refresh — runs every 3s, reads live folder when connected, else mock.
  // Waits for `sourceReady` so we don't fire a throwaway mock tick (which
  // would immediately overwrite the real process-history entry and reset
  // its running timer) in the split second before a previously-connected
  // live folder gets restored.
  useEffect(() => {
    if (!sourceReady) return;
    let cancelled = false;
    async function tick() {
      if (isComposing()) return;
      if (mode === "live" && dirRef.current) {
        try {
          const [c, s] = await Promise.all([
            readAllClients(dirRef.current),
            readServer(dirRef.current),
          ]);
          if (cancelled) return;
          setClients(c);
          recordProcessTick(c);
          c.forEach((client) => {
            if (client.online !== false) {
              recordUsage(
                client.machine,
                (client.gpuUsage || 0) + (client.cpuUsage || 0) + (client.ram || 0),
              );
            }
          });
          if (s) setServer(s);
          setLastError(null);
        } catch (e) {
          setLastError(e instanceof Error ? e.message : "read failed");
        }
      } else {
        const mockClients = generateMockClients();
        setServer(generateMockServer());
        setClients(mockClients);
        recordProcessTick(mockClients);
        mockClients.forEach((client) => {
          if (client.online !== false) {
            recordUsage(
              client.machine,
              (client.gpuUsage || 0) + (client.cpuUsage || 0) + (client.ram || 0),
            );
          }
        });
      }
    }
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [mode, sourceReady]);

  // real ping loop — every 2s probe each target, push to 6-slot history
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (isComposing()) return;
      const current = pingsRef.current;
      const results = await pingAll(current.map((t) => t.host));
      if (cancelled) return;
      if (results.length > 0) recordPing("wan1", results[0] >= 0);
      if (results.length > 1) recordPing("wan2", results[1] >= 0);
      const steamIndex = current.findIndex((t) => /steam/i.test(t.label) || /steam/i.test(t.host));
      if (steamIndex >= 0 && results[steamIndex] < 0) recordSteamDown(2);
      setPings((prev) =>
        prev.map((t, i) => ({ ...t, history: pushHistory(t.history, results[i]) })),
      );
    }
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // uptime (counts up from page open) + wall clock — set after mount to avoid
  // SSR hydration mismatch.
  useEffect(() => {
    const tick = () => {
      if (isComposing()) return;
      const s = Math.floor((Date.now() - startRef.current) / 1000);
      const h = String(Math.floor(s / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const sec = String(s % 60).padStart(2, "0");
      setUptime(`${h}:${m}:${sec}`);
      setNow(new Date().toLocaleTimeString());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // try to restore previously granted folder on mount
  useEffect(() => {
    (async () => {
      try {
        const h = await loadDirHandle();
        if (!h) return;
        const ok = await ensurePermission(h);
        if (ok) {
          dirRef.current = h;
          setFolderName(h.name);
          setMode("live");
        }
      } finally {
        setSourceReady(true);
      }
    })();
  }, []);

  async function handleConnect() {
    const h = await pickStatusDirectory();
    if (!h) return;
    const ok = await ensurePermission(h);
    if (!ok) {
      setLastError("permission denied");
      return;
    }
    dirRef.current = h;
    setFolderName(h.name);
    setMode("live");
    setLastError(null);
  }

  async function handleDisconnect() {
    await clearDirHandle();
    dirRef.current = null;
    setFolderName(null);
    setMode("mock");
  }

  const onlineCount = useMemo(() => clients.filter((c) => c.online !== false).length, [clients]);

  // Live reservation counter for the header pill.
  const [reservedCount, setReservedCount] = useState(0);
  const totalSeats = useMemo(() => defaultSeats().length, []);
  useEffect(() => {
    const recount = () => {
      const map = loadReservations();
      let n = 0;
      for (const r of Object.values(map)) if (remainingMinutes(r) > 0) n++;
      setReservedCount(n);
    };
    recount();
    window.addEventListener("exir:reservations", recount);
    window.addEventListener("storage", recount);
    const id = setInterval(() => {
      if (isComposing()) return;
      recount();
    }, 30_000);
    return () => {
      window.removeEventListener("exir:reservations", recount);
      window.removeEventListener("storage", recount);
      clearInterval(id);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div
        className="fixed inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.1 0.02 260 / 0.88), oklch(0.07 0.02 260 / 0.95))",
        }}
      />
      <div className="fixed inset-0 -z-10 grid-bg opacity-40" />
      {/* ambient blobs */}
      <div
        className="pointer-events-none fixed -top-40 -left-40 -z-10 size-96 rounded-full opacity-25 blur-3xl float-slow"
        style={{ background: "var(--neon-cyan)" }}
      />
      <div
        className="pointer-events-none fixed -bottom-40 -right-40 -z-10 size-96 rounded-full opacity-20 blur-3xl float-slow"
        style={{ background: "var(--neon-magenta)", animationDelay: "-3s" }}
      />

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="relative flex size-14 items-center justify-center overflow-hidden rounded-xl neon-border-cyan"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.22 0.06 220 / 0.6), oklch(0.18 0.05 280 / 0.6))",
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="font-mono text-3xl font-black text-glow-cyan">E</span>
              )}
              <span
                className="absolute -bottom-1 -right-1 size-3 rounded-full pulse-dot"
                style={{ background: "var(--neon-green)", boxShadow: "0 0 8px var(--neon-green)" }}
              />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-black uppercase tracking-[0.2em] leading-none">
                <span className="text-glow-cyan">Exir</span>{" "}
                <span className="text-glow-magenta">Gamenet</span>
              </h1>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
                ▸ live monitoring console ◂
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SourceControl
              mode={mode}
              folderName={folderName}
              supported={supported}
              error={lastError}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
            <StatusPill label="Stations" value={`${onlineCount}/12`} color="cyan" />
            <HotspotStatus />
            <StatusPill
              label="Reserved"
              value={`${reservedCount}/${totalSeats}`}
              color={reservedCount > 0 ? "magenta" : "cyan"}
            />
            {SHOW_SERVER_STATUS_PILL && <StatusPill label="Server" value="OK" color="green" />}
            <Link
              to="/market"
              title="فروشگاه"
              className="flex size-10 items-center justify-center rounded-lg border border-border/60 bg-surface/60 text-muted-foreground transition hover:border-cyan-500/60 hover:text-cyan-300"
            >
              <Store size={16} />
            </Link>
            <StatusPill label="Time" value={now} color="magenta" />
            <Link
              to="/settings"
              title="Gauge settings"
              className="flex size-10 items-center justify-center rounded-lg border border-border/60 bg-surface/60 text-muted-foreground transition hover:rotate-90 hover:border-cyan-500/60 hover:text-cyan-300"
            >
              <Settings size={16} />
            </Link>
          </div>
        </header>

        {/* Infrastructure status (modems / mikrotik / linux / cisco) */}
        <section className="mb-3">
          <InfraStatusPanel />
        </section>

        {/* Server */}
        <section className="mb-5">
          {SHOW_SERVER_CARD && server && <ServerCard server={{ ...server, uptime }} />}
        </section>

        {/* Clients grid */}
        <section className="mb-5">
          {SHOW_VNC_QUICK_LAUNCH && (
            <VncQuickLaunch
              total={12}
              onlineMachines={
                new Set(clients.filter((c) => c.online !== false).map((c) => c.machine))
              }
            />
          )}
          {SHOW_QOS_LAUNCH && (
            <QosLaunch
              machines={Array.from(
                { length: 12 },
                (_, i) => `VIP${String(i + 1).padStart(2, "0")}`,
              )}
            />
          )}
          {SHOW_CLIENTS_GRID && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  client stations · 12
                </h3>
                <span className="font-mono text-[10px] text-muted-foreground">
                  click a card for details
                </span>
              </div>
              <div data-clients-grid="1">
                <ClientLayoutView
                  clients={clients}
                  onSelect={setSelected}
                  layout={gaugeSettings.clientLayout}
                />
              </div>
            </>
          )}
        </section>

        {/* Ping */}
        {SHOW_PING && (
          <section>
            <PingPanel
              targets={pings}
              onEdit={(i, next) => {
                setPings((prev) => {
                  const updated = prev.map((t, idx) =>
                    idx === i ? { ...t, label: next.label, host: next.host, history: [] } : t,
                  );
                  saveTargets(updated);
                  return updated;
                });
              }}
            />
          </section>
        )}

        {/* Epic CDN Discovery — above launcher status */}
        {SHOW_EPIC_CDN_DISCOVERY && (
          <section className="mt-5">
            <EpicCdnDiscovery />
          </section>
        )}

        {/* Cache Activity (LanCache) — above network/ping */}
        {SHOW_CACHE_ACTIVITY && (
          <section className="mt-3">
            <CacheActivityPanel />
          </section>
        )}

        {/* Launcher status + Active Console Log + game platforms — side by
            side so launcher status no longer eats a whole separate row. */}
        {(SHOW_STEAM_EPIC_STATUS || SHOW_ACTIVE_CONSOLE_LOG || SHOW_GAME_PLATFORMS) && (
          <section className="mt-3 grid grid-cols-1 items-start gap-3 xl:grid-cols-[300px_360px_1fr]">
            {SHOW_STEAM_EPIC_STATUS && <SteamEpicStatus />}
            {SHOW_ACTIVE_CONSOLE_LOG && <ActiveConsoleLog />}
            {SHOW_GAME_PLATFORMS && <GamePlatformsPanel />}
          </section>
        )}

        {/* Seat reservation */}
        {SHOW_RESERVATION_BOARD && (
          <section className="mt-3">
            <ReservationBoard />
          </section>
        )}

        {/* Daily report */}
        {SHOW_DAILY_REPORT && (
          <section className="mt-3">
            <DailyReport />
          </section>
        )}

        <footer className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
          exir gamenet · monitoring v0.1 · auto-refresh 3s ·{" "}
          {mode === "live" ? `live: ${folderName}` : "mock data"}
        </footer>
      </div>

      <ClientPingProbe clients={clients} />
      <ClientDetailModal client={selected} onClose={closeDetail} />
    </div>
  );
}

function SourceControl({
  mode,
  folderName,
  supported,
  error,
  onConnect,
  onDisconnect,
}: {
  mode: SourceMode;
  folderName: string | null;
  supported: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (!supported) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-amber-300">
        browser unsupported · use chrome/edge
      </div>
    );
  }
  if (mode === "live") {
    return (
      <button
        onClick={onDisconnect}
        title={error ? `last error: ${error}` : "click to disconnect"}
        className="group flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-green-300 transition hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-300"
      >
        <span
          className="size-1.5 rounded-full pulse-dot"
          style={{
            background: error ? "var(--neon-red)" : "var(--neon-green)",
            boxShadow: `0 0 8px ${error ? "var(--neon-red)" : "var(--neon-green)"}`,
          }}
        />
        <span className="group-hover:hidden">live · {folderName}</span>
        <span className="hidden group-hover:inline">disconnect</span>
      </button>
    );
  }
  return (
    <button
      onClick={onConnect}
      className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-500/20"
    >
      📁 connect status folder
    </button>
  );
}

function StatusPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "cyan" | "green" | "magenta" | "muted";
}) {
  const c =
    color === "cyan"
      ? "var(--neon-cyan)"
      : color === "green"
        ? "var(--neon-green)"
        : color === "magenta"
          ? "var(--neon-magenta)"
          : "oklch(0.7 0.02 250)";
  return (
    <div className="rounded-lg border border-border/60 bg-surface/60 px-3 py-2 font-mono text-[11px] backdrop-blur-sm">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-bold leading-none" style={{ color: c, textShadow: `0 0 8px ${c}` }}>
        {value}
      </div>
    </div>
  );
}
