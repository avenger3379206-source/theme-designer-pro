import { useEffect, useState } from "react";
import { Network, Router, Server, HardDrive, Radio, Plus, Pencil, Zap } from "lucide-react";
import { loadInfraHosts, saveInfraHosts, makeInfraHostId, type InfraHost } from "@/lib/infra-status";
import { pingAll } from "@/lib/ping";
import { pingAllViaMikrotik } from "@/lib/mikrotik-ping";
import { fetchActiveGateways, pickActiveGatewayIp } from "@/lib/mikrotik-routes";
import { isComposing } from "@/lib/compose-lock";
import { InfraHostEditModal } from "./InfraHostEditModal";

interface Sample { ms: number; ok: boolean }

export function InfraStatusPanel() {
  const [hosts, setHosts] = useState<InfraHost[]>(() => loadInfraHosts());
  const [results, setResults] = useState<Record<string, Sample>>({});
  const [checkedAt, setCheckedAt] = useState<number>(0);
  const [editing, setEditing] = useState<{ host: InfraHost; isNew: boolean } | null>(null);
  // IP of the modem the Mikrotik's default route is currently on (فیل‌آور فعال) — null = unknown.
  const [activeGatewayIp, setActiveGatewayIp] = useState<string | null>(null);

  useEffect(() => {
    const h = () => setHosts(loadInfraHosts());
    window.addEventListener("exir:infra-hosts", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("exir:infra-hosts", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let busy = false;
    async function tick() {
      if (isComposing() || busy) return;
      busy = true;
      try {
        const direct = hosts.filter((h) => !h.viaRouter);
        const routed = hosts.filter((h) => h.viaRouter);
        const wanInPlay = hosts.some((h) => h.role === "wan");
        const [directMs, routedMs, gateways] = await Promise.all([
          pingAll(direct.map((h) => h.host)),
          pingAllViaMikrotik(routed.map((h) => h.host)),
          wanInPlay ? fetchActiveGateways() : Promise.resolve([]),
        ]);
        if (!alive) return;
        if (wanInPlay) setActiveGatewayIp(pickActiveGatewayIp(gateways));
        const next: Record<string, Sample> = {};
        direct.forEach((h, i) => {
          const v = directMs[i];
          next[h.id] = { ms: v, ok: typeof v === "number" && v >= 0 };
        });
        routed.forEach((h, i) => {
          const v = routedMs[i];
          next[h.id] = { ms: v, ok: typeof v === "number" && v >= 0 };
        });
        setResults(next);
        setCheckedAt(Date.now());
      } finally {
        busy = false;
      }
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [hosts]);

  const okCount = Object.values(results).filter((r) => r.ok).length;
  const total = hosts.length;

  function openEdit(h: InfraHost) {
    setEditing({ host: h, isNew: false });
  }

  function openAdd() {
    setEditing({
      host: { id: makeInfraHostId(), label: "", fa: "", host: "", role: "server", notes: "" },
      isNew: true,
    });
  }

  function handleSave(updated: InfraHost) {
    const exists = hosts.some((h) => h.id === updated.id);
    const next = exists ? hosts.map((h) => (h.id === updated.id ? updated : h)) : [...hosts, updated];
    setHosts(next);
    saveInfraHosts(next);
    setEditing(null);
  }

  function handleDelete(id: string) {
    const next = hosts.filter((h) => h.id !== id);
    setHosts(next);
    saveInfraHosts(next);
    setEditing(null);
  }

  return (
    <div className="mb-3 rounded-xl p-3 glass-panel" style={{ borderColor: "var(--background)" }}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          <Network size={12} /> ▸ <span className="font-fa" lang="fa">وضعیت زیرساخت</span> · infrastructure
        </h3>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold"
            style={{
              borderColor: okCount === total ? "var(--neon-green)55" : okCount === 0 ? "var(--neon-red)55" : "var(--neon-amber)55",
              color: okCount === total ? "var(--neon-green)" : okCount === 0 ? "var(--neon-red)" : "var(--neon-amber)",
              background: okCount === total ? "var(--neon-green)15" : okCount === 0 ? "var(--neon-red)15" : "var(--neon-amber)15",
            }}
          >
            {okCount}/{total} ONLINE
          </span>
          <button
            onClick={openAdd}
            title="افزودن دستگاه"
            className="flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-fuchsia-500/60 hover:text-fuchsia-400"
          >
            <Plus size={11} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {hosts.map((h) => {
          const r = results[h.id];
          const ok = r?.ok;
          const color = ok === undefined ? "oklch(0.55 0.02 250)"
            : ok ? "var(--neon-green)"
            : "var(--neon-red)";
          // فیل‌آور فعال: this WAN's IP matches the router's currently-active default gateway.
          const isActiveWan = h.role === "wan" && !!activeGatewayIp && h.host === activeGatewayIp;
          return (
            <button
              key={h.id}
              onClick={() => openEdit(h)}
              title={isActiveWan ? "فیل‌آور روی این مودم فعال است — کلیک برای ویرایش" : "کلیک برای ویرایش آی‌پی و مشخصات"}
              className={`group rounded-md border p-2 text-left transition hover:brightness-125 ${isActiveWan ? "active-wan-ring" : ""}`}
              style={{ borderColor: isActiveWan ? "var(--neon-green)" : `${color}55`, background: `${color}0d` }}
            >
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1">
                  <RoleIcon role={h.role} />
                  {h.label}
                  {isActiveWan && (
                    <span
                      title="فیل‌آور فعال روی این نت"
                      className="flex items-center gap-0.5 rounded-full px-1 py-px pulse-dot"
                      style={{ color: "var(--neon-green)", background: "var(--neon-green)1a" }}
                    >
                      <Zap size={9} fill="currentColor" />
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Pencil size={9} className="opacity-0 transition group-hover:opacity-70" />
                  {h.viaRouter && (
                    <Router
                      size={10}
                      title="پینگ از طریق روتر"
                      style={{ color: "var(--neon-cyan)" }}
                    />
                  )}
                  <span
                    className="size-2 rounded-full pulse-dot"
                    style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                  />
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-lg font-black" style={{ color, textShadow: `0 0 6px ${color}55` }}>
                  {ok ? r!.ms : "—"}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {ok ? "ms" : (r ? "loss" : "…")}
                </span>
              </div>
              <div dir="ltr" className="text-left font-mono text-[9px] text-muted-foreground/80">
                {h.host}
              </div>
              <div dir="rtl" className="font-fa text-right text-[9px] text-muted-foreground/60" lang="fa">{h.fa}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-1 text-right font-mono text-[9px] text-muted-foreground/60">
        {checkedAt ? new Date(checkedAt).toLocaleTimeString() : "—"} · every 5s via ping-agent (ICMP)
      </div>

      {editing && (
        <InfraHostEditModal
          host={editing.host}
          isNew={editing.isNew}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RoleIcon({ role }: { role: InfraHost["role"] }) {
  if (role === "wan") return <Radio size={11} />;
  if (role === "router") return <Router size={11} />;
  if (role === "server") return <Server size={11} />;
  if (role === "switch") return <HardDrive size={11} />;
  return <Network size={11} />;
}
