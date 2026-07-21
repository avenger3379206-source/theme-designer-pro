// Active Console Log — a small set of user-configured DNS/CDN hostnames that
// get pinged on a loop, rendered as a rolling terminal-style feed (see
// ActiveConsoleLog.tsx). Config is just a label list persisted to
// localStorage, same pattern as infra-status.ts / ping.ts.

export interface ConsoleHost {
  id: string;
  label: string; // hostname, e.g. "akamaized.net"
}

export type Quality = "best" | "good" | "fair" | "poor" | "down";

export interface ConsoleLogEntry {
  id: string;
  t: number;
  host: string;
  ms: number; // -1 = timeout / unreachable
  quality: Quality;
  score: number; // rolling reliability % over recent checks for this host
}

const KEY = "exir.console.hosts.v1";

export const DEFAULT_CONSOLE_HOSTS: ConsoleHost[] = [
  { id: "ch_akamaized", label: "akamaized.net" },
  { id: "ch_cloudfront", label: "cloudfront.net" },
  { id: "ch_edgekey", label: "edgekey.net" },
  { id: "ch_fastly", label: "fastly.net" },
];

export function loadConsoleHosts(): ConsoleHost[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ConsoleHost[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CONSOLE_HOSTS;
}

export function saveConsoleHosts(hosts: ConsoleHost[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(hosts));
    window.dispatchEvent(new Event("exir:console-hosts"));
  } catch {
    /* ignore */
  }
}

export function makeConsoleHostId(): string {
  return `ch_${Math.random().toString(36).slice(2, 9)}`;
}

export function qualityFromMs(ms: number): Quality {
  if (ms < 0) return "down";
  if (ms <= 30) return "best";
  if (ms <= 60) return "good";
  if (ms <= 120) return "fair";
  return "poor";
}

export function qualityLabel(q: Quality): string {
  switch (q) {
    case "best":
      return "Best";
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    case "poor":
      return "Poor";
    default:
      return "Down";
  }
}

export function qualityColor(q: Quality): string {
  switch (q) {
    case "best":
      return "var(--neon-green)";
    case "good":
      return "oklch(0.82 0.2 155)";
    case "fair":
      return "var(--neon-amber)";
    case "poor":
      return "oklch(0.7 0.22 40)";
    default:
      return "var(--neon-red)";
  }
}
