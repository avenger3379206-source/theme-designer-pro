// Active Console Log — user-configured DNS entries that get pinged on a loop,
// rendered as a single-line-per-DNS ranking panel (see ActiveConsoleLog.tsx).
// Each entry has a display name + up to two DNS server IPs/hostnames.
// Config is persisted to localStorage with a migration from the old label-only
// format.

export interface ConsoleHost {
  id: string;
  name: string; // display name, e.g. "Cloudflare"
  dns1: string; // primary DNS IP/hostname
  dns2: string; // secondary DNS IP/hostname (may be empty)
}

export type Quality = "best" | "good" | "fair" | "poor" | "down";

export interface ConsoleLogEntry {
  id: string;
  hostId: string;
  t: number; // timestamp of this 30s cycle
  name: string;
  dns1: string;
  dns2: string;
  ms1: number; // ping of dns1, -1 = timeout
  ms2: number; // ping of dns2, -1 = timeout
  ms: number; // best of ms1/ms2 (or the only available), -1 = all timeout
  quality: Quality;
}

const KEY = "exir.console.hosts.v1";
const KEY_LEGACY = "exir.console.hosts.v1"; // same key — we migrate in-place

interface LegacyHost {
  id: string;
  label: string;
}

export const DEFAULT_CONSOLE_HOSTS: ConsoleHost[] = [
  { id: "ch_cloudflare", name: "Cloudflare", dns1: "1.1.1.1", dns2: "1.0.0.1" },
  { id: "ch_google", name: "Google", dns1: "8.8.8.8", dns2: "8.8.4.4" },
  { id: "ch_quad9", name: "Quad9", dns1: "9.9.9.9", dns2: "149.112.112.112" },
  { id: "ch_opendns", name: "OpenDNS", dns1: "208.67.222.222", dns2: "208.67.220.220" },
  { id: "ch_adguard", name: "AdGuard", dns1: "94.140.14.14", dns2: "94.140.15.15" },
];

export function loadConsoleHosts(): ConsoleHost[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Migrate legacy { id, label } → { id, name, dns1, dns2 }
        const migrated: ConsoleHost[] = parsed.map((h: LegacyHost | ConsoleHost, i: number) => {
          if (typeof (h as LegacyHost).label === "string" && !(h as ConsoleHost).dns1) {
            const label = (h as LegacyHost).label;
            return {
              id: h.id || `ch_mig_${i}`,
              name: label,
              dns1: label,
              dns2: "",
            };
          }
          return h as ConsoleHost;
        });
        if (migrated.length > 0) return migrated;
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CONSOLE_HOSTS;
}

export function saveConsoleHosts(hosts: ConsoleHost[]) {
  try {
    localStorage.setItem(KEY_LEGACY, JSON.stringify(hosts));
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
      return "best";
    case "good":
      return "good";
    case "fair":
      return "normal";
    case "poor":
      return "bad";
    default:
      return "down";
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
