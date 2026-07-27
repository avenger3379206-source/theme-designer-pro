// Live per-client peripheral status — polls each VIP's exir-client-agent
// (http://<ip>:8766/peripherals) so the dashboard can flag a station whose
// keyboard, mouse, headset, or monitor has come loose or died, without
// needing anyone to physically walk over and check. Completely separate
// from MSI Afterburner, which only reports GPU/CPU sensor data.
//
// Same publish/subscribe shape as client-ping.ts: results go on
// window.__exirPeripherals and a CustomEvent fires so ClientCard and the
// alert engine can both react without prop-drilling.

export interface PeripheralStatus {
  machine: string;
  ok: boolean;
  keyboard: boolean;
  mouse: boolean;
  headset: boolean;
  controller: boolean;
  monitorCount: number; // -1 = couldn't determine
  error?: string;
  updatedAt: number;
}

export const PERIPHERAL_EVT = "exir:peripherals";

declare global {
  interface Window {
    __exirPeripherals?: Record<string, PeripheralStatus>;
  }
}

export function publishPeripherals(map: Record<string, PeripheralStatus>) {
  if (typeof window === "undefined") return;
  window.__exirPeripherals = map;
  window.dispatchEvent(new Event(PERIPHERAL_EVT));
}

/** Fetches one client's peripheral status. Never throws — network errors
 * come back as `{ ok: false, error }` so a single unreachable station
 * doesn't break the polling loop for everyone else. */
export async function fetchPeripherals(machine: string, host: string, timeoutMs = 6000): Promise<PeripheralStatus> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(`http://${host}:8766/peripherals`, { signal: ctrl.signal }).finally(() =>
      clearTimeout(t),
    );
    const j = (await r.json().catch(() => ({}))) as Partial<PeripheralStatus>;
    return {
      machine,
      ok: !!j.ok,
      keyboard: !!j.keyboard,
      mouse: !!j.mouse,
      headset: !!j.headset,
      controller: !!j.controller,
      monitorCount: typeof j.monitorCount === "number" ? j.monitorCount : -1,
      error: j.error || (!r.ok ? `client-agent HTTP ${r.status}` : undefined),
      updatedAt: Date.now(),
    };
  } catch (e) {
    return {
      machine,
      ok: false,
      keyboard: false,
      mouse: false,
      headset: false,
      controller: false,
      monitorCount: -1,
      error: `client-agent unreachable: ${(e as Error).message}`,
      updatedAt: Date.now(),
    };
  }
}

/** True when a station is missing something worth alerting about.
 * Headset/controller are informational only — plenty of stations run
 * without either, so they don't count as a "problem" on their own. */
export function hasPeripheralProblem(p: PeripheralStatus): boolean {
  if (!p.ok) return false; // agent unreachable is a connectivity issue, not a peripheral one
  if (!p.keyboard || !p.mouse) return true;
  if (p.monitorCount === 0) return true;
  return false;
}
