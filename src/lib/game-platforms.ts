// Game platform status + latency probes.
// Statuspage.io style summaries are CORS-open; Steam is proxied via ping-agent.

export type PlatLevel = "ok" | "warn" | "down" | "unknown";

export interface PlatformStatus {
  key: string;
  name: string;
  level: PlatLevel;
  note?: string;
}

interface StatuspageComp { name: string; status: string }

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function normStatuspage(raw: unknown, wanted: string): PlatLevel {
  const comps = (raw as { components?: StatuspageComp[] } | undefined)?.components ?? [];
  const c = comps.find((x) => x.name.toLowerCase().includes(wanted.toLowerCase()));
  if (!c) return "unknown";
  if (c.status === "operational") return "ok";
  if (c.status === "degraded_performance" || c.status === "partial_outage") return "warn";
  if (c.status === "major_outage" || c.status === "under_maintenance") return "down";
  return "unknown";
}

export async function loadPlatforms(): Promise<PlatformStatus[]> {
  const [steam, epic, discord, riot, ea, bnet] = await Promise.all([
    fetchJson("http://localhost:8765/steam"),
    fetchJson("https://status.epicgames.com/api/v2/summary.json"),
    fetchJson("https://discordstatus.com/api/v2/summary.json"),
    // Riot uses regional status; we ping the shared launcher status
    fetchJson("https://status.riotgames.com/api/v1/products/lol/regions/eu-west"),
    fetchJson("https://status.ea.com/api/v2/summary.json"),
    // Battle.net has no public JSON — best-effort HEAD via agent later; unknown default.
    Promise.resolve(null),
  ]);
  const steamLevel: PlatLevel = (() => {
    const s = (steam as { services?: Record<string, [string, string]> } | undefined)?.services?.cms;
    if (!s) return "unknown";
    return s[0] === "good" ? "ok" : s[0] === "minor" || s[0] === "slow" ? "warn" : "down";
  })();
  const riotLevel: PlatLevel = (() => {
    if (!riot) return "unknown";
    const incidents = (riot as { incidents?: unknown[] }).incidents ?? [];
    const maint = (riot as { maintenances?: unknown[] }).maintenances ?? [];
    if (incidents.length > 2) return "down";
    if (incidents.length > 0 || maint.length > 0) return "warn";
    return "ok";
  })();
  return [
    { key: "steam",    name: "Steam",       level: steamLevel },
    { key: "epic",     name: "Epic Games",  level: epic     ? normStatuspage(epic, "Launcher") : "unknown" },
    { key: "discord",  name: "Discord",     level: discord  ? normStatuspage(discord, "API")   : "unknown" },
    { key: "riot",     name: "Riot",        level: riotLevel },
    { key: "ea",       name: "EA",          level: ea       ? normStatuspage(ea, "Origin")     : "unknown" },
    { key: "bnet",     name: "Battle.net",  level: bnet ? "ok" : "unknown", note: "manual" },
  ];
}

// Latency targets per platform: { platform: [{region, host}] }
// CS2 / Dota2 rows use per-country (or per-datacenter) public probes as a
// stand-in for Valve's matchmaking datacenters, since those are only
// reachable from inside the game (private relay IPs, no ICMP). Hetzner's
// public speedtest hosts are used where they sit in the exact requested
// city (Helsinki, Falkenstein); everywhere else we probe a well-known
// public host physically located in that country/region.
export const LATENCY_TARGETS: Record<string, { region: string; host: string }[]> = {
  CS2: [
    { region: "United Arab Emirates", host: "ae.pool.ntp.org" },
    { region: "EU Stockholm",         host: "se.pool.ntp.org" },
    { region: "India Mumbai",         host: "in.pool.ntp.org" },
    { region: "EU Amsterdam",         host: "nl.pool.ntp.org" },
    { region: "EU Helsinki",          host: "hel1-speed.hetzner.com" },
    { region: "EU Frankfurt",         host: "de.pool.ntp.org" },
    { region: "United Kingdom",       host: "uk.pool.ntp.org" },
    { region: "EU Warsaw",            host: "pl.pool.ntp.org" },
    { region: "EU Falkenstein",       host: "fsn1-speed.hetzner.com" },
    { region: "India Chennai",        host: "in.pool.ntp.org" },
  ],
  Dota2: [
    { region: "Dubai",        host: "ae.pool.ntp.org" },
    { region: "Europe West",  host: "lu.pool.ntp.org" },
    { region: "Europe East",  host: "at.pool.ntp.org" },
    { region: "Russia",       host: "ru.pool.ntp.org" },
    { region: "India",        host: "in.pool.ntp.org" },
    { region: "SE Asia",      host: "sg.pool.ntp.org" },
  ],
  Discord: [
    { region: "Frankfurt", host: "discord.com" },
    { region: "Dubai",     host: "gateway.discord.gg" },
  ],
};
