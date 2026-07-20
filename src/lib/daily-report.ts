// Rolling persisted today-tallies for the daily report. The "day" rolls over
// at 03:00 local time, matching the gamenet close/open cycle.
//
// v3: now also tracks per-machine download bytes and per-service (game
// category) bytes — sourced from LanCache access.log via CacheActivityPanel.
// Every parsed line is fed here via `recordBytes(machine, service, bytes)`.

const TODAY_KEY = "exir.daily.today.v3";
const YESTERDAY_KEY = "exir.daily.snapshot.v2";

export interface MachineBytes { machine: string; down: number; up: number }
export interface CategoryBytes { service: string; down: number }

export interface DailySnapshot {
  date: string;
  wan1Uptime: number;
  wan2Uptime: number;
  steamDownMinutes: number;
  topConsumer: string;
  perMachine: MachineBytes[];     // sorted desc by down+up
  perCategory: CategoryBytes[];   // sorted desc by down
  totalDown: number;
  totalUp: number;
}

interface Counters {
  date: string;
  startedAt: number;
  wan1Ok: number; wan1Total: number;
  wan2Ok: number; wan2Total: number;
  steamDown: number;
  perMachine: Record<string, number>;              // usage score
  perMachineDown: Record<string, number>;          // bytes
  perMachineUp: Record<string, number>;            // bytes
  perCategoryDown: Record<string, number>;         // bytes by service
}

let counters: Counters = fresh();

function fresh(): Counters {
  return {
    date: businessDate(),
    startedAt: Date.now(),
    wan1Ok: 0, wan1Total: 0,
    wan2Ok: 0, wan2Total: 0,
    steamDown: 0,
    perMachine: {},
    perMachineDown: {},
    perMachineUp: {},
    perCategoryDown: {},
  };
}

function hasStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function businessDate(d = new Date()): string {
  const shifted = new Date(d);
  if (shifted.getHours() < 3) shifted.setDate(shifted.getDate() - 1);
  return shifted.toISOString().slice(0, 10);
}

function loadCounters(): Counters {
  if (!hasStorage()) return counters;
  try {
    const raw = localStorage.getItem(TODAY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Counters>;
      if (parsed.date === businessDate()) {
        counters = {
          date: parsed.date,
          startedAt: Number(parsed.startedAt) || Date.now(),
          wan1Ok: Number(parsed.wan1Ok) || 0,
          wan1Total: Number(parsed.wan1Total) || 0,
          wan2Ok: Number(parsed.wan2Ok) || 0,
          wan2Total: Number(parsed.wan2Total) || 0,
          steamDown: Number(parsed.steamDown) || 0,
          perMachine: obj(parsed.perMachine),
          perMachineDown: obj(parsed.perMachineDown),
          perMachineUp: obj(parsed.perMachineUp),
          perCategoryDown: obj(parsed.perCategoryDown),
        };
        return counters;
      }
      if (parsed.date) localStorage.setItem(YESTERDAY_KEY, JSON.stringify(snapshotFrom(parsed)));
    }
  } catch { /* ignore */ }
  counters = fresh();
  saveCounters();
  return counters;
}

function obj(v: unknown): Record<string, number> {
  return v && typeof v === "object" ? (v as Record<string, number>) : {};
}

function saveCounters() {
  if (!hasStorage()) return;
  try { localStorage.setItem(TODAY_KEY, JSON.stringify(counters)); } catch { /* ignore */ }
}

function ensureToday() {
  const current = loadCounters();
  if (current.date !== businessDate()) rollover();
}

function snapshotFrom(c: Partial<Counters>): DailySnapshot {
  const perMachineScore = obj(c.perMachine);
  const perMachineDown = obj(c.perMachineDown);
  const perMachineUp = obj(c.perMachineUp);
  const perCategoryDown = obj(c.perCategoryDown);

  const topScore = Object.entries(perMachineScore).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const topBytes = Object.entries(perMachineDown).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

  const machines = new Set([
    ...Object.keys(perMachineDown),
    ...Object.keys(perMachineUp),
  ]);
  const perMachine: MachineBytes[] = Array.from(machines)
    .map((m) => ({ machine: m, down: perMachineDown[m] || 0, up: perMachineUp[m] || 0 }))
    .sort((a, b) => (b.down + b.up) - (a.down + a.up));

  const perCategory: CategoryBytes[] = Object.entries(perCategoryDown)
    .map(([service, down]) => ({ service, down: Number(down) || 0 }))
    .sort((a, b) => b.down - a.down);

  const wan1Total = Number(c.wan1Total) || 0;
  const wan2Total = Number(c.wan2Total) || 0;
  return {
    date: c.date || businessDate(),
    wan1Uptime: wan1Total ? ((Number(c.wan1Ok) || 0) / wan1Total) * 100 : 0,
    wan2Uptime: wan2Total ? ((Number(c.wan2Ok) || 0) / wan2Total) * 100 : 0,
    steamDownMinutes: Math.round((Number(c.steamDown) || 0) / 60),
    topConsumer: topBytes?.[0] ?? topScore?.[0] ?? "—",
    perMachine,
    perCategory,
    totalDown: perMachine.reduce((s, m) => s + m.down, 0),
    totalUp: perMachine.reduce((s, m) => s + m.up, 0),
  };
}

export function recordPing(target: "wan1" | "wan2", ok: boolean) {
  ensureToday();
  if (target === "wan1") { counters.wan1Total++; if (ok) counters.wan1Ok++; }
  else { counters.wan2Total++; if (ok) counters.wan2Ok++; }
  saveCounters();
}

export function recordSteamDown(seconds: number) {
  ensureToday();
  counters.steamDown += seconds;
  saveCounters();
}

export function recordUsage(machine: string, score: number) {
  ensureToday();
  counters.perMachine[machine] = (counters.perMachine[machine] || 0) + score;
  saveCounters();
}

// New: called by CacheActivityPanel for every parsed access.log line.
// direction defaults to "down" (LanCache logs downloads to clients).
export function recordBytes(machine: string, service: string, bytes: number, direction: "down" | "up" = "down") {
  if (!machine || !bytes || bytes <= 0) return;
  ensureToday();
  const svc = (service || "other").toLowerCase();
  if (direction === "down") {
    counters.perMachineDown[machine] = (counters.perMachineDown[machine] || 0) + bytes;
    counters.perCategoryDown[svc] = (counters.perCategoryDown[svc] || 0) + bytes;
  } else {
    counters.perMachineUp[machine] = (counters.perMachineUp[machine] || 0) + bytes;
  }
  saveCounters();
}

export function computeToday(): DailySnapshot {
  ensureToday();
  return snapshotFrom(counters);
}

export function loadYesterday(): DailySnapshot | null {
  try {
    const raw = localStorage.getItem(YESTERDAY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export function rollover() {
  const snap = snapshotFrom(counters);
  if (hasStorage()) localStorage.setItem(YESTERDAY_KEY, JSON.stringify(snap));
  counters = fresh();
  saveCounters();
}

// Format bytes as human string.
export function fmtBytes(n: number): string {
  if (!n || n < 1024) return `${n | 0} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Schedule a rollover for 03:00 tomorrow, then every 24h after.
export function startDailyScheduler() {
  ensureToday();
  const now = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();
  setTimeout(() => {
    rollover();
    setInterval(rollover, 24 * 60 * 60 * 1000);
  }, delay);
}
