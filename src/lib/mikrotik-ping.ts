// Pings hosts FROM the Mikrotik router itself, via ping-agent's
// /mikrotik/ping route (which calls the router's REST /tool/ping).
//
// Why: this dashboard runs on the LAN side (e.g. 192.168.3.0/24) and only
// has a route to the router (192.168.3.200) and other LAN devices. It has
// NO route to the modem subnets (192.168.1.0/24 for WAN1, 192.168.2.0/24
// for WAN2) — only the router has an interface on each of those. So WAN1/
// WAN2 must be pinged BY the router, not by this box, or one of them will
// always look "down" regardless of its real status (whichever one isn't
// the active failover link).

import { loadMikrotikConfig } from "./mikrotik-config";

const AGENT_URL = "http://localhost:8765";
const TIMEOUT_MS = 20000;

/**
 * Ping every host from the router. Returns ms latency per host, or -1 for
 * loss/unreachable, in the same order as the input array. If the agent or
 * router is unreachable, or Mikrotik credentials aren't set in Settings,
 * every entry comes back -1 (same "offline" signal as a failed direct ping).
 */
export async function pingAllViaMikrotik(hosts: string[]): Promise<number[]> {
  if (hosts.length === 0) return [];
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${AGENT_URL}/mikrotik/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...loadMikrotikConfig(), hosts }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; results?: number[] };
    if (Array.isArray(json.results) && json.results.length === hosts.length) {
      return json.results.map((v) => (typeof v === "number" ? v : -1));
    }
  } catch {
    /* agent/router unreachable — fall through to all -1 below */
  }
  return hosts.map(() => -1);
}
