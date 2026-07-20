// Asks the ping-agent (which talks to the Mikrotik's REST /ip/route) which
// modem's default route is currently active — i.e. which link the failover
// ("فیل‌آور") has switched onto. Used by InfraStatusPanel to highlight the
// WAN card that's actually carrying traffic right now.

import { loadMikrotikConfig } from "./mikrotik-config";

const AGENT_URL = "http://localhost:8765";
const TIMEOUT_MS = 12000;

export interface RouteGateway {
  gateway: string;   // e.g. "192.168.1.1" — matches InfraHost.host for WAN entries
  active: boolean;
  disabled: boolean;
  distance: number;
}

/**
 * Returns the router's default-route table (one entry per modem gateway).
 * Empty array if the agent/router is unreachable or Mikrotik credentials
 * aren't set — callers should treat that as "unknown", not "down".
 */
export async function fetchActiveGateways(): Promise<RouteGateway[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${AGENT_URL}/mikrotik/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loadMikrotikConfig()),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; gateways?: RouteGateway[] };
    if (json.ok && Array.isArray(json.gateways)) return json.gateways;
  } catch {
    /* agent/router unreachable — fall through to empty below */
  }
  return [];
}

/** Convenience: the gateway IP that's actually active right now, if any. */
export function pickActiveGatewayIp(gateways: RouteGateway[]): string | null {
  const active = gateways.find((g) => g.active && !g.disabled);
  return active ? active.gateway : null;
}
