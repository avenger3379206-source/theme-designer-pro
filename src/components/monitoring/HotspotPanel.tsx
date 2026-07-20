import { useEffect, useState } from "react";
import { Users, Clock, Wifi, User } from "lucide-react";

const ROUTER_IP = "192.168.3.200";
const ROUTER_USER = "exir-agent"; // از .env یا تنظیمات
const ROUTER_PASS = "#22302791B#";

interface HotspotUser {
  name: string;
  ip: string;
  mac: string;
  uptime: string;
  bytes: string;
}

export function HotspotPanel() {
  const [users, setUsers] = useState<HotspotUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const fetchHotspot = async () => {
    setLoading(true);
    try {
      // API call به MikroTik (RouterOS REST یا SSH wrapper)
      const res = await fetch(`/api/mikrotik/hotspot?ip=${ROUTER_IP}`, {
        headers: { Authorization: `Basic ${btoa(`${ROUTER_USER}:${ROUTER_PASS}`)}` }
      });
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error("Hotspot fetch failed", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHotspot();
    const int = setInterval(fetchHotspot, 10000); // هر 10s
    return () => clearInterval(int);
  }, []);

  return (
    <div className="mb-3 rounded-xl p-3 glass-panel">
      <div className="mb-2 flex items-center justify-between cursor-pointer" onClick={() => setShowDetail(!showDetail)}>
        <h3 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          <Wifi size={12} /> ▸ HOTSPOT USERS · {total} connected
        </h3>
        <span className="text-xs text-muted-foreground">{loading ? "..." : "live"}</span>
      </div>

      {showDetail && (
        <div className="mt-2 max-h-80 overflow-auto text-[10px] font-mono border border-border/50 rounded p-2 bg-black/40">
          <table className="w-full">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left py-1">User/IP</th>
                <th className="text-left">MAC</th>
                <th className="text-right">Uptime</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-white/5">
                  <td>{u.name} <span className="text-cyan-400">({u.ip})</span></td>
                  <td className="text-rose-400">{u.mac}</td>
                  <td className="text-right text-emerald-400">{u.uptime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}