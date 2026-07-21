// ─────────────────────────────────────────────────────────────────────────
// Phase 7 — Per-client "what ran, when, for how long" log.
//
// Every dashboard tick (see routes/index.tsx) calls recordTick(clients) with
// the freshest ClientStatus[]. We diff each client's `topProcess` against
// what we saw last tick:
//   - process changed  → close the previous running entry, open a new one
//   - client went offline → the whole log for that machine is wiped
//     (per the requirement: stats must zero out the moment a station drops)
//   - client came back online → starts a brand-new, empty log
//
// This is intentionally a live/session log, not a permanent database: it
// lives in memory + localStorage (survives an accidental page refresh, but
// not an offline blip), matching the "reset when offline" requirement.
// ─────────────────────────────────────────────────────────────────────────

import type { ClientStatus } from "./monitoring-types";

export interface ProcessLogEntry {
  process: string;
  startedAt: number; // epoch ms
  endedAt: number | null; // null = still running right now
}

const EVT = "exir:process-history";
const KEY = (machine: string) => `exir.process-history.${machine}`;
const STATE_KEY = (machine: string) => `exir.process-history-state.${machine}`;

const store: Record<string, ProcessLogEntry[]> = {};
const lastState: Record<string, { online: boolean; process: string }> = {};

// Values that mean "nothing meaningful running" — never logged as an entry.
const IGNORE = new Set(["", "-", "—", "idle", "none", "explorer.exe", "explorer"]);

function normalize(p: string | undefined): string {
  const v = (p || "").trim();
  return IGNORE.has(v.toLowerCase()) ? "" : v;
}

function load(machine: string): ProcessLogEntry[] {
  if (store[machine]) return store[machine];
  try {
    const raw = localStorage.getItem(KEY(machine));
    store[machine] = raw ? (JSON.parse(raw) as ProcessLogEntry[]) : [];
  } catch {
    store[machine] = [];
  }
  return store[machine];
}

function persist(machine: string) {
  try {
    localStorage.setItem(KEY(machine), JSON.stringify(store[machine] || []));
  } catch {
    /* ignore quota errors */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVT, { detail: { machine } }));
  } catch {
    /* ignore (non-browser context) */
  }
}

/** Reads the last-known online/process state for a machine, falling back to
 * localStorage on the first call after a fresh page load. Without this, a
 * plain page refresh (e.g. leaving and returning from the shop) would look
 * identical to "client just came online" and wipe the log every time. */
function readLastState(machine: string): { online: boolean; process: string } | undefined {
  if (lastState[machine]) return lastState[machine];
  try {
    const raw = localStorage.getItem(STATE_KEY(machine));
    if (raw) {
      lastState[machine] = JSON.parse(raw) as { online: boolean; process: string };
      return lastState[machine];
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function writeLastState(machine: string, state: { online: boolean; process: string }) {
  lastState[machine] = state;
  try {
    localStorage.setItem(STATE_KEY(machine), JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

/** Call once per poll tick with the latest client list (mock or live). */
export function recordTick(clients: ClientStatus[]): void {
  const now = Date.now();
  for (const c of clients) {
    const machine = c.machine;
    const online = c.online !== false;
    const prev = readLastState(machine);
    const list = load(machine);

    if (!online) {
      // Reset the log the moment a station drops offline — but only do the
      // (relatively expensive) clear+persist once, not on every tick while
      // it stays offline.
      if (!prev || prev.online !== false) {
        store[machine] = [];
        writeLastState(machine, { online: false, process: "" });
        persist(machine);
      }
      continue;
    }

    const proc = normalize(c.topProcess);

    if (!prev) {
      // First tick ever for this machine (no saved state at all, even in
      // localStorage) — start a clean log.
      store[machine] = proc ? [{ process: proc, startedAt: now, endedAt: null }] : [];
      writeLastState(machine, { online: true, process: proc });
      persist(machine);
      continue;
    }

    if (prev.online === false) {
      // Genuinely went offline→online — start a fresh log.
      store[machine] = proc ? [{ process: proc, startedAt: now, endedAt: null }] : [];
      writeLastState(machine, { online: true, process: proc });
      persist(machine);
      continue;
    }

    if (prev.process !== proc) {
      const open = list[list.length - 1];
      if (open && open.endedAt === null) open.endedAt = now;
      if (proc) list.push({ process: proc, startedAt: now, endedAt: null });
      writeLastState(machine, { online: true, process: proc });
      persist(machine);
    }
  }
}

/** Newest-first list of everything logged for this machine since it last came online. */
export function getHistory(machine: string): ProcessLogEntry[] {
  return load(machine).slice().reverse();
}

/** Fires cb() whenever this machine's log changes (new entry / reset). */
export function subscribeProcessHistory(machine: string, cb: () => void): () => void {
  const h = (e: Event) => {
    const detail = (e as CustomEvent<{ machine: string }>).detail;
    if (detail?.machine === machine) cb();
  };
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}

/** Total time spent per process (running entry counts up to "now"). */
export function totalsByProcess(machine: string): { process: string; ms: number }[] {
  const now = Date.now();
  const totals: Record<string, number> = {};
  for (const e of load(machine)) {
    totals[e.process] = (totals[e.process] || 0) + ((e.endedAt ?? now) - e.startedAt);
  }
  return Object.entries(totals)
    .map(([process, ms]) => ({ process, ms }))
    .sort((a, b) => b.ms - a.ms);
}
