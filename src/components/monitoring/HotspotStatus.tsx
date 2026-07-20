import { useEffect, useState } from "react";
import { Wifi, X, RefreshCw, Users, Clock, Hash } from "lucide-react";
import { fetchHotspotActive, formatBytes, formatUptime, type HotspotUser } from "@/lib/hotspot";
import { isComposing } from "@/lib/compose-lock";

/** Header pill + modal showing Mikrotik hotspot active sessions. */
export function HotspotStatus() {
  const [users, setUsers] = useState<HotspotUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    if (isComposing()) return;
    setLoading(true);
    const snap = await fetchHotspotActive();
    setLoading(false);
    if (snap.ok) {
      setUsers(snap.users);
      setError(null);
    } else {
      setError(snap.error || "خطا در دریافت هات‌اسپات");
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const count = users.length;
  const color = error ? "var(--neon-red)" : count > 0 ? "var(--neon-green)" : "var(--neon-cyan)";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={error ? `Hotspot: ${error}` : `${count} hotspot user${count === 1 ? "" : "s"} online`}
        className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/60 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:border-cyan-500/60 hover:text-cyan-300"
      >
        <Wifi size={12} style={{ color, filter: `drop-shadow(0 0 4px ${color})` }} />
        <span className="text-[10px] text-muted-foreground">HOTSPOT</span>
        <span className="font-bold" style={{ color, textShadow: `0 0 6px ${color}55` }}>
          {error ? "—" : count}
        </span>
        {count > 0 && (
          <span
            className="size-1.5 rounded-full pulse-dot"
            style={{ background: color, boxShadow: `0 0 6px ${color}` }}
          />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "oklch(0.05 0.02 260 / 0.65)", backdropFilter: "blur(16px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl glass-panel neon-border-cyan"
          >
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <Wifi size={16} className="text-cyan-300" />
                <h2 className="font-fa font-mono text-sm font-bold uppercase tracking-widest text-glow-cyan">
                  کاربران فعال هات‌اسپات میکروتیک · {count}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={refresh}
                  disabled={loading}
                  title="بروزرسانی"
                  className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition hover:text-foreground hover:border-cyan-500/60 disabled:opacity-50"
                >
                  <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border/60 p-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/40"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {error && (
              <div
                className="mx-5 mt-4 rounded border px-3 py-2 text-xs"
                style={{
                  borderColor: "var(--neon-red)55",
                  background: "var(--neon-red)10",
                  color: "var(--neon-red)",
                }}
              >
                {error} — تنظیمات اتصال میکروتیک را از صفحه Settings ذخیره کن و مطمئن شو REST API هات‌اسپات فعال است.
              </div>
            )}

            {users.length === 0 && !error ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-muted-foreground">
                <Users size={28} className="opacity-40" />
                <p className="font-fa text-xs">هیچ کاربری در حال حاضر به هات‌اسپات وصل نیست.</p>
              </div>
            ) : (
              <div className="max-h-[65vh] overflow-y-auto p-4">
                <table className="w-full font-mono text-[11px]">
                  <thead className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    <tr className="border-b border-border/40">
                      <th className="px-2 py-2 text-right">
                        <Hash size={10} className="inline" /> نام کاربر
                      </th>
                      <th className="px-2 py-2 text-right">IP</th>
                      <th className="px-2 py-2 text-right">MAC</th>
                      <th className="px-2 py-2 text-right">
                        <Clock size={10} className="inline" /> مدت اتصال
                      </th>
                      <th className="px-2 py-2 text-right">مانده</th>
                      <th className="px-2 py-2 text-right">دانلود</th>
                      <th className="px-2 py-2 text-right">آپلود</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id || `${u.macAddress}-${u.address}`}
                        className="border-b border-border/20 transition hover:bg-cyan-500/5"
                      >
                        <td className="px-2 py-2 font-bold text-foreground">{u.user || "—"}</td>
                        <td className="px-2 py-2 text-cyan-300">{u.address || "—"}</td>
                        <td className="px-2 py-2 text-muted-foreground">{u.macAddress || "—"}</td>
                        <td className="px-2 py-2" style={{ color: "var(--neon-green)" }}>
                          {formatUptime(u.uptime)}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {u.sessionTimeLeft ? formatUptime(u.sessionTimeLeft) : "∞"}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">{formatBytes(u.bytesIn)}</td>
                        <td className="px-2 py-2 text-muted-foreground">{formatBytes(u.bytesOut)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.some((u) => u.comment) && (
                  <div className="mt-3 space-y-1 text-[10px] text-muted-foreground">
                    {users
                      .filter((u) => u.comment)
                      .map((u) => (
                        <div key={`c-${u.id}`}>
                          <span className="text-cyan-300">{u.user}:</span> {u.comment}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
