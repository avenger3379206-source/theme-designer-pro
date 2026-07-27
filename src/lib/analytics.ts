// Long-term (rolling, never auto-reset) usage analytics — busiest hours of
// the day, a day-by-day trend, and the most-played games — built from the
// same live tick data everything else on the dashboard already uses.
// Intentionally lightweight: a few counters in localStorage, no external
// analytics/telemetry involved.

import type { ClientStatus } from "./monitoring-types";

const KEY = "exir.analytics.v1";
const EVT = "exir:analytics";
const MAX_DAYS = 30;

// Same "nothing meaningful running" values process-history.ts ignores.
const IGNORE = new Set(["", "-", "—", "idle", "none", "explorer.exe", "explorer"]);

interface HourBucket {
  sumOnline: number; // sum of "online client count" samples seen at this hour
  samples: number;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD (local time)
  sumOnline: number;
  samples: number;
  peakOnline: number;
  gameHours: number; // total client-hours spent running a game/app that day
}

export interface AnalyticsData {
  version: 1;
  startedAt: number;
  hourly: HourBucket[]; // 24 buckets, index = hour-of-day, averaged across all days ever recorded
  games: Record<string, number>; // process name -> total minutes, all-time
  days: DailyStat[]; // last MAX_DAYS days, oldest first
  lastTickAt: number;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function empty(): AnalyticsData {
  return {
    version: 1,
    startedAt: Date.now(),
    hourly: Array.from({ length: 24 }, () => ({ sumOnline: 0, samples: 0 })),
    games: {},
    days: [],
    lastTickAt: 0,
  };
}

let cache: AnalyticsData | null = null;

export function loadAnalytics(): AnalyticsData {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AnalyticsData>;
      cache = {
        version: 1,
        startedAt: p.startedAt ?? Date.now(),
        hourly: Array.isArray(p.hourly) && p.hourly.length === 24 ? p.hourly : empty().hourly,
        games: p.games && typeof p.games === "object" ? p.games : {},
        days: Array.isArray(p.days) ? p.days : [],
        lastTickAt: p.lastTickAt ?? 0,
      };
      return cache;
    }
  } catch {
    /* ignore */
  }
  cache = empty();
  return cache;
}

function persist() {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota errors */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    /* ignore */
  }
}

/** Call once per dashboard poll tick with the freshest client list. */
export function recordAnalyticsTick(clients: ClientStatus[]): void {
  const data = loadAnalytics();
  const now = Date.now();
  const online = clients.filter((c) => c.online !== false);
  const onlineCount = online.length;

  // Busiest-hour histogram (rolling average across every day recorded).
  const hour = new Date().getHours();
  data.hourly[hour].sumOnline += onlineCount;
  data.hourly[hour].samples += 1;

  // Elapsed time since the previous tick, attributed to today + whatever
  // each client is currently running. Capped so a big gap (tab backgrounded,
  // page left open overnight) can't dump a bogus chunk onto one day/game.
  const elapsedMin = data.lastTickAt > 0 ? Math.min((now - data.lastTickAt) / 60000, 10) : 0;

  if (elapsedMin > 0) {
    for (const c of online) {
      const proc = (c.topProcess || "").trim();
      if (!proc || IGNORE.has(proc.toLowerCase())) continue;
      data.games[proc] = (data.games[proc] || 0) + elapsedMin;
    }
  }

  const key = todayKey();
  let today = data.days[data.days.length - 1];
  if (!today || today.date !== key) {
    today = { date: key, sumOnline: 0, samples: 0, peakOnline: 0, gameHours: 0 };
    data.days.push(today);
    if (data.days.length > MAX_DAYS) data.days.shift();
  }
  today.sumOnline += onlineCount;
  today.samples += 1;
  today.peakOnline = Math.max(today.peakOnline, onlineCount);
  today.gameHours += (elapsedMin * onlineCount) / 60;

  data.lastTickAt = now;
  persist();
}

export function topGames(limit = 8): { name: string; minutes: number }[] {
  const data = loadAnalytics();
  return Object.entries(data.games)
    .map(([name, minutes]) => ({ name, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, limit);
}

export function hourlyLoad(): { hour: number; avg: number }[] {
  const data = loadAnalytics();
  return data.hourly.map((b, hour) => ({ hour, avg: b.samples > 0 ? b.sumOnline / b.samples : 0 }));
}

export function busiestHour(): { hour: number; avg: number } | null {
  const rows = hourlyLoad().filter((r) => r.avg > 0);
  if (rows.length === 0) return null;
  return rows.reduce((best, r) => (r.avg > best.avg ? r : best));
}

export function recentDays(limit = 14): DailyStat[] {
  const data = loadAnalytics();
  return data.days.slice(-limit);
}

export function resetAnalytics(): void {
  cache = empty();
  persist();
}
