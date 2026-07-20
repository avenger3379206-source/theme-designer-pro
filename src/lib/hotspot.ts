// Live MikroTik Hotspot active-users state.
//
// The ping-agent proxies to Mikrotik REST /ip/hotspot/active and returns a
// normalized list of active hotspot sessions. Refreshed periodically by
// HotspotStatus, and only the operator dashboard consumes this.

import { loadMikrotikConfig } from "./mikrotik-config";

export interface HotspotUser {
  id: string;
  user: string;         // hotspot login username
  address: string;      // client IP
  macAddress: string;   // client MAC
  uptime: string;       // e.g. "1h23m5s"
  sessionTimeLeft?: string;
  bytesIn?: number;
  bytesOut?: number;
  loginBy?: string;
  server?: string;      // hotspot server name
  comment?: string;
}

export interface HotspotSnapshot {
  ok: boolean;
  error?: string;
  users: HotspotUser[];
  updatedAt: number;
}

export async function fetchHotspotActive(): Promise<HotspotSnapshot> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch("http://localhost:8765/hotspot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loadMikrotikConfig()),
      signal: ctrl.signal,
    }).finally(() =>
      clearTimeout(t),
    );
    const j = (await r.json().catch(() => ({}))) as {
      ok?: boolean;
      users?: HotspotUser[];
      error?: string;
    };
    if (!r.ok || !j.ok) {
      return { ok: false, error: j.error || `agent HTTP ${r.status}`, users: [], updatedAt: Date.now() };
    }
    return { ok: true, users: Array.isArray(j.users) ? j.users : [], updatedAt: Date.now() };
  } catch (e) {
    return {
      ok: false,
      error: `agent unreachable: ${String((e as Error)?.message || e)}`,
      users: [],
      updatedAt: Date.now(),
    };
  }
}

/** Human-readable "1h 23m" from Mikrotik uptime strings like "1h23m5s" or "45s". */
export function formatUptime(s: string): string {
  if (!s) return "—";
  const m = s.match(/(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!m) return s;
  const [, w, d, h, mm, ss] = m;
  const parts: string[] = [];
  if (w) parts.push(`${w}w`);
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (mm) parts.push(`${mm}m`);
  if (!w && !d && !h && ss) parts.push(`${ss}s`);
  return parts.length ? parts.join(" ") : s;
}

export function formatBytes(n?: number): string {
  if (!n || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
