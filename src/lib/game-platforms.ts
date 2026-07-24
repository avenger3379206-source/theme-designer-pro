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
//
// IMPORTANT: Valve's CS2/Dota2 matchmaking datacenters are private relay IPs
// only reachable from inside the game (Steam Datagram Relay network). No public
// ICMP ping can reach them. So we probe a well-known public host physically
// located in the SAME city/region as each Valve datacenter — the geographic
// distance (and thus the network path) is the same, so the ballpark latency
// matches what you see in-game.
//
// We deliberately AVOID the NTP pool (xx.pool.ntp.org): it uses geo-DNS that
// depends on the resolver's location, so ae.pool.ntp.org often resolves to a
// server in Europe instead of the UAE when queried from an Iranian ISP —
// producing 135ms for a region that should be ~43ms. Cloud-provider regional
// endpoints (AWS ec2.<region>.amazonaws.com) resolve to fixed IPs in the exact
// city and have direct peering with most ISPs, giving far more accurate results.
//
// ICMP latency will still differ slightly from in-game latency (Steam's SDR
// relay network uses optimized private paths), but the geographic proximity
// means the numbers are in the right ballpark instead of 3x too high.
export const LATENCY_TARGETS: Record<string, { region: string; host: string }[]> = {
  CS2: [
    { region: "United Arab Emirates", host: "ec2.me-central-1.amazonaws.com" }, // AWS UAE (Dubai)
    { region: "EU Stockholm",         host: "ec2.eu-north-1.amazonaws.com" },    // AWS Stockholm
    { region: "India Mumbai",         host: "ec2.ap-south-1.amazonaws.com" },    // AWS Mumbai
    { region: "EU Amsterdam",         host: "ec2.eu-central-1.amazonaws.com" },  // AWS Frankfurt (~300km from AMS)
    { region: "EU Helsinki",          host: "hel1-speed.hetzner.com" },           // Hetzner Helsinki
    { region: "EU Frankfurt",         host: "ec2.eu-central-1.amazonaws.com" },  // AWS Frankfurt
    { region: "United Kingdom",       host: "ec2.eu-west-2.amazonaws.com" },     // AWS London
    { region: "EU Warsaw",            host: "ec2.eu-central-1.amazonaws.com" },  // AWS Frankfurt (closest to Warsaw)
    { region: "EU Falkenstein",       host: "fsn1-speed.hetzner.com" },           // Hetzner Falkenstein
    { region: "India Chennai",        host: "ec2.ap-south-1.amazonaws.com" },    // AWS Mumbai (closest to Chennai)
  ],
  Dota2: [
    { region: "Dubai",        host: "ec2.me-central-1.amazonaws.com" },   // AWS UAE (Dubai)
    { region: "Europe West",  host: "ec2.eu-west-1.amazonaws.com" },      // AWS Ireland (Europe West)
    { region: "Europe East",  host: "ec2.eu-central-1.amazonaws.com" },   // AWS Frankfurt (central EU)
    { region: "Russia",       host: "ec2.eu-north-1.amazonaws.com" },     // AWS Stockholm (closest to western RU)
    { region: "India",        host: "ec2.ap-south-1.amazonaws.com" },     // AWS Mumbai
    { region: "SE Asia",      host: "ec2.ap-southeast-1.amazonaws.com" }, // AWS Singapore
  ],
  Discord: [
    { region: "Frankfurt", host: "discord.com" },
    { region: "Dubai",     host: "gateway.discord.gg" },
  ],
};
